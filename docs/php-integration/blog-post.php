<?php
/**
 * blog-post.php — Single blog post page for urologybymanmeet.com
 *
 * HOW ROUTING WORKS
 * -----------------
 * The URL /blog/kidney-stone-treatment/ needs to call this file
 * with $slug = "kidney-stone-treatment".
 *
 * Option A (Apache .htaccess — recommended):
 *   Add to your .htaccess in the /blog/ directory:
 *     RewriteEngine On
 *     RewriteCond %{REQUEST_FILENAME} !-f
 *     RewriteCond %{REQUEST_FILENAME} !-d
 *     RewriteRule ^([a-z0-9-]+)/?$ /blog/post.php?slug=$1 [QSA,L]
 *   Then rename this file to /blog/post.php
 *
 * Option B (index.php in /blog/ subdirectory):
 *   Rename this file to /blog/index.php and read the slug from the path:
 *     $slug = basename(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
 *
 * Option C (existing router):
 *   Pass $slug as a variable before including this file.
 */

require_once __DIR__ . '/CrmApi.php';

// ── Get slug ──────────────────────────────────────────────────────────────────
$slug = trim($_GET['slug'] ?? '', '/');
$slug = preg_replace('/[^a-z0-9-]/', '', strtolower($slug));

if (empty($slug)) {
    header('Location: /blog/');
    exit;
}

// ── Fetch from CRM ────────────────────────────────────────────────────────────
$result = CrmApi::getBlog($slug);

// 404 if blog not found or not published
if (!$result || empty($result['blog'])) {
    header('HTTP/1.1 404 Not Found');
    include __DIR__ . '/404.php';
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

  <!-- ── Core SEO ── -->
  <title><?= htmlspecialchars($seo['title']) ?></title>
  <meta name="description" content="<?= htmlspecialchars($seo['metaDescription']) ?>">
  <link rel="canonical" href="<?= htmlspecialchars($seo['canonical']) ?>">
  <?php if (!empty($seo['keywords'])): ?>
    <meta name="keywords" content="<?= htmlspecialchars($seo['keywords']) ?>">
  <?php endif; ?>

  <!-- ── Open Graph ── -->
  <meta property="og:type"              content="<?= htmlspecialchars($seo['openGraph']['type']) ?>">
  <meta property="og:title"             content="<?= htmlspecialchars($seo['openGraph']['title']) ?>">
  <meta property="og:description"       content="<?= htmlspecialchars($seo['openGraph']['description']) ?>">
  <meta property="og:url"               content="<?= htmlspecialchars($seo['openGraph']['url']) ?>">
  <meta property="og:site_name"         content="<?= htmlspecialchars($seo['openGraph']['siteName']) ?>">
  <?php if (!empty($seo['openGraph']['image'])): ?>
    <meta property="og:image"           content="<?= htmlspecialchars($seo['openGraph']['image']) ?>">
    <meta property="og:image:width"     content="1200">
    <meta property="og:image:height"    content="630">
  <?php endif; ?>
  <?php if (!empty($seo['openGraph']['publishedAt'])): ?>
    <meta property="article:published_time" content="<?= htmlspecialchars($seo['openGraph']['publishedAt']) ?>">
    <meta property="article:modified_time"  content="<?= htmlspecialchars($seo['openGraph']['modifiedAt']) ?>">
  <?php endif; ?>

  <!-- ── Twitter Card ── -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="<?= htmlspecialchars($seo['openGraph']['title']) ?>">
  <meta name="twitter:description" content="<?= htmlspecialchars($seo['openGraph']['description']) ?>">
  <?php if (!empty($seo['openGraph']['image'])): ?>
    <meta name="twitter:image"     content="<?= htmlspecialchars($seo['openGraph']['image']) ?>">
  <?php endif; ?>

  <!-- ── JSON-LD: Article Schema ── -->
  <script type="application/ld+json">
    <?= json_encode($seo['schema'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?>
  </script>

  <!-- ── JSON-LD: Breadcrumb Schema ── -->
  <script type="application/ld+json">
    <?= json_encode($seo['breadcrumbSchema'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?>
  </script>

  <!-- Your existing CSS -->
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>

  <?php include __DIR__ . '/includes/header.php'; ?>

  <main class="blog-post">
    <div class="container container--narrow">

      <!-- Breadcrumb (visual — schema is in <head>) -->
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/blog/">Blog</a></li>
          <li aria-current="page"><?= htmlspecialchars($blog['title']) ?></li>
        </ol>
      </nav>

      <article class="post">

        <!-- Header -->
        <header class="post__header">
          <h1 class="post__title"><?= htmlspecialchars($blog['title']) ?></h1>

          <div class="post__meta">
            <span class="post__author">By <?= htmlspecialchars($blog['author']) ?></span>
            <time class="post__date" datetime="<?= htmlspecialchars($blog['publishedAt']) ?>">
              <?= date('F j, Y', strtotime($blog['publishedAt'])) ?>
            </time>
            <?php if (!empty($blog['readingTime'])): ?>
              <span class="post__reading-time"><?= (int)$blog['readingTime'] ?> min read</span>
            <?php endif; ?>
          </div>
        </header>

        <!-- Featured image -->
        <?php if (!empty($blog['featuredImage'])): ?>
          <figure class="post__featured-image">
            <img
              src="<?= htmlspecialchars($blog['featuredImage']) ?>"
              alt="<?= htmlspecialchars($blog['title']) ?>"
              width="1200" height="630"
            >
          </figure>
        <?php endif; ?>

        <!-- Content — already sanitized by CRM before storage -->
        <div class="post__content">
          <?= $blog['content'] ?>
        </div>

        <!-- Author bio -->
        <footer class="post__author-bio">
          <div class="author-card">
            <div class="author-card__info">
              <p class="author-card__name"><?= htmlspecialchars($blog['author']) ?></p>
              <p class="author-card__title"><?= htmlspecialchars($blog['doctor']['specialty'] ?? '') ?></p>
              <a href="/book-appointment/" class="btn btn--primary">Book a Consultation</a>
            </div>
          </div>
        </footer>

      </article>

      <!-- Back to blog -->
      <div class="post__back">
        <a href="/blog/" class="btn btn--outline">&larr; All Articles</a>
      </div>

    </div>
  </main>

  <?php include __DIR__ . '/includes/footer.php'; ?>

</body>
</html>
