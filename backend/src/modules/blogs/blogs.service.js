const slugify      = require('slugify');
const path         = require('path');
const fs           = require('fs');
const sanitizeHtml = require('sanitize-html');
const prisma       = require('../../config/database');
const env          = require('../../config/env');
const { paginate, paginationMeta } = require('../../utils/pagination');

// Allowed HTML elements and attributes for blog content.
// Blocks <script>, <iframe>, event handlers (onclick, etc.) and all JS URLs.
const SANITIZE_OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'strong', 'em', 'u', 's', 'blockquote',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'code', 'pre', 'span', 'div',
  ],
  allowedAttributes: {
    'a':   ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height', 'loading'],
    'td':  ['colspan', 'rowspan'],
    'th':  ['colspan', 'rowspan'],
    '*':   ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Strip any attribute value that starts with javascript:
  allowedSchemesByTag: { 'a': ['http', 'https', 'mailto'] },
};

const sanitize = (html) => sanitizeHtml(html || '', SANITIZE_OPTIONS);

const BLOG_SELECT = {
  id: true, title: true, slug: true, featuredImage: true,
  seoTitle: true, metaDescription: true, keywords: true,
  status: true, publishedAt: true, doctorId: true,
  createdAt: true, updatedAt: true,
  doctor: { select: { id: true, name: true, specialty: true, domain: true } },
};

const BLOG_FULL_SELECT = { ...BLOG_SELECT, content: true };

// ── Slug helpers ──────────────────────────────────────────────────────────────
const makeSlug = (title) =>
  slugify(title, { lower: true, strict: true, trim: true });

// Ensure slug is unique per doctor — appends -2, -3 ... if collision
const uniqueSlug = async (title, doctorId, excludeId = null) => {
  const base = makeSlug(title);
  let candidate = base;
  let counter   = 1;

  while (true) {
    const existing = await prisma.blog.findFirst({
      where: {
        slug: candidate,
        doctorId,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
};

// ── CRM list (all statuses) ───────────────────────────────────────────────────
const getAll = async (query, tenantFilter) => {
  const { skip, take, page, limit } = paginate(query);
  const { search, status, doctorId } = query;

  const where = {
    ...tenantFilter,
    ...(status && { status }),
    ...(doctorId && !tenantFilter.doctorId && { doctorId: parseInt(doctorId) }),
    ...(search && {
      OR: [
        { title:           { contains: search } },
        { seoTitle:        { contains: search } },
        { metaDescription: { contains: search } },
        { keywords:        { contains: search } },
      ],
    }),
  };

  const [blogs, total] = await prisma.$transaction([
    prisma.blog.findMany({
      where, select: BLOG_SELECT, skip, take,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.blog.count({ where }),
  ]);

  return { blogs, pagination: paginationMeta(total, page, limit) };
};

// ── Single (full content) ─────────────────────────────────────────────────────
const getById = async (id, tenantFilter) => {
  const blog = await prisma.blog.findFirst({
    where: { id, ...tenantFilter },
    select: BLOG_FULL_SELECT,
  });
  if (!blog) throw { statusCode: 404, message: 'Blog not found' };
  return blog;
};

// ── Create ────────────────────────────────────────────────────────────────────
const create = async (data) => {
  const { title, content, seoTitle, metaDescription, keywords, doctorId, featuredImage } = data;
  const slug = await uniqueSlug(title, parseInt(doctorId));

  return prisma.blog.create({
    data: {
      title,
      content: sanitize(content),
      slug, featuredImage,
      seoTitle:        seoTitle        || title,
      metaDescription: metaDescription || '',
      keywords:        keywords        || '',
      doctorId: parseInt(doctorId),
      status: 'DRAFT',
    },
    select: BLOG_FULL_SELECT,
  });
};

// ── Update ────────────────────────────────────────────────────────────────────
const update = async (id, data, tenantFilter) => {
  const blog = await getById(id, tenantFilter);
  const { title, content, seoTitle, metaDescription, keywords } = data;

  // Regenerate slug only if title changed
  const slug = title && title !== blog.title
    ? await uniqueSlug(title, blog.doctorId, id)
    : blog.slug;

  return prisma.blog.update({
    where: { id },
    data: {
      ...(title   !== undefined && { title, slug }),
      ...(content !== undefined && { content: sanitize(content) }),
      ...(seoTitle        !== undefined && { seoTitle }),
      ...(metaDescription !== undefined && { metaDescription }),
      ...(keywords        !== undefined && { keywords }),
    },
    select: BLOG_FULL_SELECT,
  });
};

// ── Featured image ────────────────────────────────────────────────────────────
const updateImage = async (id, filePath, tenantFilter) => {
  const blog = await getById(id, tenantFilter);

  // Delete old image file if it exists
  if (blog.featuredImage) {
    const oldPath = path.join(__dirname, '..', '..', '..', env.UPLOAD_DIR,
      path.basename(blog.featuredImage));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  return prisma.blog.update({
    where: { id },
    data: { featuredImage: `/uploads/${path.basename(filePath)}` },
    select: BLOG_FULL_SELECT,
  });
};

// ── Publish / Unpublish ───────────────────────────────────────────────────────
const setStatus = async (id, status, tenantFilter) => {
  await getById(id, tenantFilter);
  return prisma.blog.update({
    where: { id },
    data: {
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
    select: BLOG_FULL_SELECT,
  });
};

// ── Delete ────────────────────────────────────────────────────────────────────
const remove = async (id, tenantFilter) => {
  const blog = await getById(id, tenantFilter);

  // Clean up image file
  if (blog.featuredImage) {
    const imgPath = path.join(__dirname, '..', '..', '..', env.UPLOAD_DIR,
      path.basename(blog.featuredImage));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  await prisma.blog.delete({ where: { id } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  (used by doctor websites for SEO server-side rendering)
// ─────────────────────────────────────────────────────────────────────────────

// Strip HTML tags and collapse whitespace — used to generate plain-text excerpts
const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// Returns absolute URL for a stored image path, or null
const absoluteImageUrl = (path) => (path ? `${env.API_BASE_URL}${path}` : null);

// List published blogs for a doctor
const getPublished = async (doctorId, query) => {
  const { skip, take, page, limit } = paginate(query);

  const where = { doctorId, status: 'PUBLISHED' };

  const [rawBlogs, total] = await prisma.$transaction([
    prisma.blog.findMany({
      where,
      // Select a small content slice only to derive excerpt when metaDescription is absent.
      // Full content is NOT returned in the list — only used server-side for excerpt generation.
      select: {
        id: true, title: true, slug: true, featuredImage: true,
        seoTitle: true, metaDescription: true, keywords: true,
        publishedAt: true, createdAt: true,
        content: true,                          // used for excerpt only, stripped below
        doctor: { select: { name: true, specialty: true, domain: true } },
      },
      skip, take,
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.blog.count({ where }),
  ]);

  // Shape each blog for public consumption — no raw content in the response
  const blogs = rawBlogs.map(({ content, featuredImage, ...blog }) => ({
    ...blog,
    featuredImage: absoluteImageUrl(featuredImage),
    // excerpt: prefer the manually written metaDescription; fall back to first 160 chars of content
    excerpt: blog.metaDescription || stripHtml(content).slice(0, 160),
    author: blog.doctor.name,
  }));

  return { blogs, pagination: paginationMeta(total, page, limit) };
};

// Single published blog by slug — returns full content + pre-built SEO package
const getPublishedBySlug = async (slug, doctorId) => {
  const raw = await prisma.blog.findFirst({
    where: { slug, doctorId, status: 'PUBLISHED' },
    select: {
      ...BLOG_FULL_SELECT,
      doctor: {
        select: { id: true, name: true, specialty: true, domain: true, logoUrl: true },
      },
    },
  });
  if (!raw) throw { statusCode: 404, message: 'Blog post not found' };

  const domain    = raw.doctor.domain;
  const canonical = `https://${domain}/blog/${slug}`;
  const imageUrl  = absoluteImageUrl(raw.featuredImage);

  // Plain-text excerpt: manual metaDescription > first 160 chars of content
  const excerpt = raw.metaDescription || stripHtml(raw.content).slice(0, 160);

  // Reading time: ~200 words per minute, minimum 1 minute
  const wordCount   = stripHtml(raw.content).split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Clean blog object — absolute image URL, excerpt + readingTime + author at top level
  const blog = {
    ...raw,
    featuredImage: imageUrl,
    excerpt,
    readingTime,
    author: raw.doctor.name,
  };

  const seoPackage = {
    title:           raw.seoTitle || raw.title,
    metaDescription: raw.metaDescription || '',
    canonical,
    keywords:        raw.keywords || '',

    openGraph: {
      type:        'article',
      title:       raw.seoTitle || raw.title,
      description: raw.metaDescription || '',
      url:         canonical,
      image:       imageUrl,
      siteName:    `Dr. ${raw.doctor.name}`,
      publishedAt: raw.publishedAt,
      modifiedAt:  raw.updatedAt,
    },

    // JSON-LD Article schema — drop into <script type="application/ld+json">
    schema: {
      '@context':    'https://schema.org',
      '@type':       'Article',
      headline:      raw.title,
      description:   raw.metaDescription || '',
      image:         imageUrl ? [imageUrl] : undefined,
      datePublished: raw.publishedAt,
      dateModified:  raw.updatedAt,
      author: {
        '@type':   'Person',
        name:      raw.doctor.name,
        jobTitle:  raw.doctor.specialty,
        url:       `https://${domain}`,
      },
      publisher: {
        '@type': 'Person',
        name:    raw.doctor.name,
        image:   raw.doctor.logoUrl || undefined,
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    },

    // Breadcrumb schema
    breadcrumbSchema: {
      '@context': 'https://schema.org',
      '@type':    'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `https://${domain}` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `https://${domain}/blog` },
        { '@type': 'ListItem', position: 3, name: raw.title, item: canonical },
      ],
    },
  };

  return { blog, seo: seoPackage };
};

module.exports = {
  getAll, getById, create, update, updateImage,
  setStatus, remove, getPublished, getPublishedBySlug,
};
