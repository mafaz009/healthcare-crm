<?php
/**
 * blog-list.php — Blog archive page for urologybymanmeet.com
 *
 * Place this file (or copy its logic) wherever your blog listing lives.
 * Include CrmApi.php first — adjust the path to match your file structure.
 *
 * URL pattern this page handles:
 *   /blog/           → page 1
 *   /blog/?page=2    → page 2
 */

require_once __DIR__ . '/CrmApi.php';

// ── Pagination ────────────────────────────────────────────────────────────────
$currentPage = max(1, (int)($_GET['page'] ?? 1));
$perPage     = 9; // 3×3 grid

// ── Fetch from CRM ────────────────────────────────────────────────────────────
$result = CrmApi::getBlogs($currentPage, $perPage);

$blogs      = $result['blogs']      ?? [];
$pagination = $result['pagination'] ?? [];
$totalPages = $pagination['totalPages'] ?? 1;

// ── Page SEO ──────────────────────────────────────────────────────────────────
$pageTitle       = 'Urology Blog | Expert Health Articles | Dr. Manmeet';
$metaDescription = 'Expert articles on kidney stones, urological health, and treatments by Dr. Manmeet Singh, leading urologist.';
$canonical       = 'https://urologybymanmeet.com/blog' . ($currentPage > 1 ? '/?page=' . $currentPage : '/');

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($pageTitle) ?></title>
  <meta name="description" content="<?= htmlspecialchars($metaDescription) ?>">
  <link rel="canonical" href="<?= htmlspecialchars($canonical) ?>">

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="<?= htmlspecialchars($pageTitle) ?>">
  <meta property="og:description" content="<?= htmlspecialchars($metaDescription) ?>">
  <meta property="og:url"         content="<?= htmlspecialchars($canonical) ?>">

  <!-- Pagination hints for Google -->
  <?php if ($currentPage > 1): ?>
    <link rel="prev" href="<?= htmlspecialchars('https://urologybymanmeet.com/blog/?page=' . ($currentPage - 1)) ?>">
  <?php endif; ?>
  <?php if ($currentPage < $totalPages): ?>
    <link rel="next" href="<?= htmlspecialchars('https://urologybymanmeet.com/blog/?page=' . ($currentPage + 1)) ?>">
  <?php endif; ?>

  <!-- Your existing CSS -->
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>

  <?php include __DIR__ . '/includes/header.php'; ?>

  <main class="blog-archive">
    <div class="container">

      <header class="section-header">
        <h1>Health Articles &amp; Guides</h1>
        <p>Expert insights on urological health from Dr. Manmeet Singh</p>
      </header>

      <?php if (empty($blogs)): ?>
        <div class="blog-empty">
          <p>No articles published yet. Check back soon.</p>
        </div>
      <?php else: ?>

        <div class="blog-grid">
          <?php foreach ($blogs as $blog): ?>
            <article class="blog-card">

              <?php if ($blog['featuredImage']): ?>
                <a href="/blog/<?= htmlspecialchars($blog['slug']) ?>/" class="blog-card__image-link">
                  <img
                    src="<?= htmlspecialchars($blog['featuredImage']) ?>"
                    alt="<?= htmlspecialchars($blog['title']) ?>"
                    loading="lazy"
                    width="600" height="400"
                  >
                </a>
              <?php endif; ?>

              <div class="blog-card__body">
                <h2 class="blog-card__title">
                  <a href="/blog/<?= htmlspecialchars($blog['slug']) ?>/">
                    <?= htmlspecialchars($blog['title']) ?>
                  </a>
                </h2>

                <p class="blog-card__excerpt">
                  <?= htmlspecialchars($blog['excerpt']) ?>
                </p>

                <footer class="blog-card__meta">
                  <span class="blog-card__author">
                    By <?= htmlspecialchars($blog['author']) ?>
                  </span>
                  <time datetime="<?= htmlspecialchars($blog['publishedAt']) ?>">
                    <?= date('F j, Y', strtotime($blog['publishedAt'])) ?>
                  </time>
                </footer>

                <a href="/blog/<?= htmlspecialchars($blog['slug']) ?>/" class="btn btn--outline">
                  Read Article →
                </a>
              </div>

            </article>
          <?php endforeach; ?>
        </div>

        <!-- Pagination -->
        <?php if ($totalPages > 1): ?>
          <nav class="pagination" aria-label="Blog pages">
            <?php if ($currentPage > 1): ?>
              <a href="/blog/?page=<?= $currentPage - 1 ?>" class="pagination__prev">&larr; Previous</a>
            <?php endif; ?>

            <span class="pagination__info">
              Page <?= $currentPage ?> of <?= $totalPages ?>
            </span>

            <?php if ($currentPage < $totalPages): ?>
              <a href="/blog/?page=<?= $currentPage + 1 ?>" class="pagination__next">Next &rarr;</a>
            <?php endif; ?>
          </nav>
        <?php endif; ?>

      <?php endif; ?>

    </div>
  </main>

  <?php include __DIR__ . '/includes/footer.php'; ?>

</body>
</html>
