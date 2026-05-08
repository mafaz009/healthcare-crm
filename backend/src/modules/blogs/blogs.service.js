const slugify = require('slugify');
const path    = require('path');
const fs      = require('fs');
const prisma  = require('../../config/database');
const env     = require('../../config/env');
const { paginate, paginationMeta } = require('../../utils/pagination');

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
      title, content, slug, featuredImage,
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
      ...(content !== undefined && { content }),
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

// List published blogs for a doctor
const getPublished = async (doctorId, query) => {
  const { skip, take, page, limit } = paginate(query);

  const where = { doctorId, status: 'PUBLISHED' };

  const [blogs, total] = await prisma.$transaction([
    prisma.blog.findMany({
      where,
      // No content in list — too heavy; website renders list page from these fields
      select: {
        id: true, title: true, slug: true, featuredImage: true,
        seoTitle: true, metaDescription: true, keywords: true, publishedAt: true,
        doctor: { select: { name: true, specialty: true, domain: true } },
      },
      skip, take,
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.blog.count({ where }),
  ]);

  return { blogs, pagination: paginationMeta(total, page, limit) };
};

// Single published blog by slug — returns full content + pre-built SEO package
const getPublishedBySlug = async (slug, doctorId) => {
  const blog = await prisma.blog.findFirst({
    where: { slug, doctorId, status: 'PUBLISHED' },
    select: {
      ...BLOG_FULL_SELECT,
      doctor: {
        select: { id: true, name: true, specialty: true, domain: true, logoUrl: true },
      },
    },
  });
  if (!blog) throw { statusCode: 404, message: 'Blog post not found' };

  const domain     = blog.doctor.domain;
  const canonical  = `https://${domain}/blog/${slug}`;
  const imageUrl   = blog.featuredImage
    ? `${env.API_BASE_URL}${blog.featuredImage}`
    : null;

  const seoPackage = {
    title:           blog.seoTitle || blog.title,
    metaDescription: blog.metaDescription || '',
    canonical,
    keywords:        blog.keywords || '',

    openGraph: {
      type:        'article',
      title:       blog.seoTitle || blog.title,
      description: blog.metaDescription || '',
      url:         canonical,
      image:       imageUrl,
      siteName:    `Dr. ${blog.doctor.name}`,
      publishedAt: blog.publishedAt,
      modifiedAt:  blog.updatedAt,
    },

    // JSON-LD Article schema — paste directly into <script type="application/ld+json">
    schema: {
      '@context':       'https://schema.org',
      '@type':          'Article',
      headline:         blog.title,
      description:      blog.metaDescription || '',
      image:            imageUrl ? [imageUrl] : undefined,
      datePublished:    blog.publishedAt,
      dateModified:     blog.updatedAt,
      author: {
        '@type': 'Person',
        name:    blog.doctor.name,
        jobTitle: blog.doctor.specialty,
        url:     `https://${domain}`,
      },
      publisher: {
        '@type': 'Person',
        name:    blog.doctor.name,
        image:   blog.doctor.logoUrl || undefined,
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    },

    // Breadcrumb schema
    breadcrumbSchema: {
      '@context': 'https://schema.org',
      '@type':    'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home',  item: `https://${domain}` },
        { '@type': 'ListItem', position: 2, name: 'Blog',  item: `https://${domain}/blog` },
        { '@type': 'ListItem', position: 3, name: blog.title, item: canonical },
      ],
    },
  };

  return { blog, seo: seoPackage };
};

module.exports = {
  getAll, getById, create, update, updateImage,
  setStatus, remove, getPublished, getPublishedBySlug,
};
