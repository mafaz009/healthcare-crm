<?php
/**
 * blog-post.php — Single blog post page
 * ───────────────────────────────────────────────────────────────
 * WHERE THIS FILE GOES:
 *   Rename to: /blog/post.php  on the doctor's website
 *
 * HOW URLS WORK:
 *   urologybymanmeet.com/blog/kidney-stone-treatment/
 *       ↓ .htaccess rewrites to ↓
 *   /blog/post.php?slug=kidney-stone-treatment
 *
 * The .htaccess rules in htaccess-blog.txt handle this rewriting.
 *
 * REQUIRES:
 *   CrmApi.php must be uploaded to /includes/CrmApi.php
 * ───────────────────────────────────────────────────────────────
 */

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/CrmApi.php';

// ── Get and sanitize the slug ─────────────────────────────────────────────────
// .htaccess passes it as ?slug=keyword-here
$slug = trim($_GET['slug'] ?? '', '/');
$slug = preg_replace('/[^a-z0-9-]/', '', strtolower($slug));

if (empty($slug)) {
    header('Location: /blog/');
    exit;
}

// ── Fetch from CRM ────────────────────────────────────────────────────────────
$result = CrmApi::getBlogBySlug($slug);

// 404 — blog not found or not published
if (!$result || empty($result['blog'])) {
    http_response_code(404);
    // Option A: include your existing 404 page
    // include $_SERVER['DOCUMENT_ROOT'] . '/404.php'; exit;
    // Option B: redirect to blog list
    header('Location: /blog/');
    exit;
}

$blog = $result['blog'];
$seo  = $result['seo'];

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- ── Core SEO ────────────────────────────────────────────── -->
  <title><?= htmlspecialchars($seo['title']) ?></title>
  <meta name="description" content="<?= htmlspecialchars($seo['metaDescription']) ?>">
  <link rel="canonical" href="<?= htmlspecialchars($seo['canonical']) ?>">

  <?php if (!empty($seo['keywords'])): ?>
    <meta name="keywords" content="<?= htmlspecialchars($seo['keywords']) ?>">
  <?php endif; ?>

  <!-- ── Open Graph ─────────────────────────────────────────── -->
  <meta property="og:type"        content="article">
  <meta property="og:title"       content="<?= htmlspecialchars($seo['openGraph']['title']) ?>">
  <meta property="og:description" content="<?= htmlspecialchars($seo['openGraph']['description']) ?>">
  <meta property="og:url"         content="<?= htmlspecialchars($seo['openGraph']['url']) ?>">
  <meta property="og:site_name"   content="<?= htmlspecialchars($seo['openGraph']['siteName']) ?>">

  <?php if (!empty($seo['openGraph']['image'])): ?>
    <meta property="og:image"        content="<?= htmlspecialchars($seo['openGraph']['image']) ?>">
    <meta property="og:image:width"  content="1200">
    <meta property="og:image:height" content="630">
  <?php endif; ?>

  <?php if (!empty($seo['openGraph']['publishedAt'])): ?>
    <meta property="article:published_time" content="<?= htmlspecialchars($seo['openGraph']['publishedAt']) ?>">
    <meta property="article:modified_time"  content="<?= htmlspecialchars($seo['openGraph']['modifiedAt']) ?>">
  <?php endif; ?>

  <!-- ── Twitter Card ───────────────────────────────────────── -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="<?= htmlspecialchars($seo['openGraph']['title']) ?>">
  <meta name="twitter:description" content="<?= htmlspecialchars($seo['openGraph']['description']) ?>">
  <?php if (!empty($seo['openGraph']['image'])): ?>
    <meta name="twitter:image"     content="<?= htmlspecialchars($seo['openGraph']['image']) ?>">
  <?php endif; ?>

  <!-- ── JSON-LD: Article Schema ────────────────────────────── -->
  <script type="application/ld+json">
  <?= json_encode($seo['schema'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?>
  </script>

  <!-- ── JSON-LD: Breadcrumb Schema ─────────────────────────── -->
  <script type="application/ld+json">
  <?= json_encode($seo['breadcrumbSchema'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?>
  </script>

  <!-- === Paste your existing <link> and <style> tags below === -->
</head>
<body>

  <!-- === Paste your existing header/nav include below === -->
  <?php /* include $_SERVER['DOCUMENT_ROOT'] . '/includes/header.php'; */ ?>

  <main>
    <article class="blog-post">
      <div class="container container--narrow">

        <!-- Breadcrumb (visual — schema version is in <head>) -->
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a> &rsaquo;
          <a href="/blog/">Blog</a> &rsaquo;
          <span><?= htmlspecialchars($blog['title']) ?></span>
        </nav>

        <!-- Post header -->
        <header class="post-header">
          <h1><?= htmlspecialchars($blog['title']) ?></h1>

          <div class="post-meta">
            <span>By <?= htmlspecialchars($blog['author']) ?></span>
            &middot;
            <time datetime="<?= htmlspecialchars($blog['publishedAt']) ?>">
              <?= date('F j, Y', strtotime($blog['publishedAt'])) ?>
            </time>
            <?php if (!empty($blog['readingTime'])): ?>
              &middot;
              <span><?= (int)$blog['readingTime'] ?> min read</span>
            <?php endif; ?>
          </div>
        </header>

        <!-- Featured image -->
        <?php if (!empty($blog['featuredImage'])): ?>
          <figure class="post-featured-image">
            <img
              src="<?= htmlspecialchars($blog['featuredImage']) ?>"
              alt="<?= htmlspecialchars($blog['title']) ?>"
              width="1200" height="630"
            >
          </figure>
        <?php endif; ?>

        <!-- Post content
             SAFE: content is sanitized by CRM before storage (sanitize-html).
             htmlspecialchars() is NOT used here — we want the HTML tags to render.
             Scripts, iframes, and event handlers are already stripped by the CRM. -->
        <div class="post-content">
          <?= $blog['content'] ?>
        </div>

        <!-- Back link -->
        <div class="post-footer">
          <a href="/blog/" class="btn-back">&larr; Back to all articles</a>
        </div>

      </div>
    </article>
  </main>

  <!-- === Paste your existing footer include below === -->
  <?php /* include $_SERVER['DOCUMENT_ROOT'] . '/includes/footer.php'; */ ?>

</body>
</html>
