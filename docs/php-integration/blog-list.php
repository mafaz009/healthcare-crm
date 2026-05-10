<?php
/**
 * blog-list.php — Blog archive page
 * ───────────────────────────────────────────────────────────────
 * WHERE THIS FILE GOES:
 *   Rename to: /blog/index.php  on the doctor's website
 *   (the /blog/ directory should already exist or create it)
 *
 * HOW URLS WORK:
 *   urologybymanmeet.com/blog/          → this file, page 1
 *   urologybymanmeet.com/blog/?page=2   → this file, page 2
 *
 * REQUIRES:
 *   CrmApi.php must be uploaded to /includes/CrmApi.php
 *   Adjust the require_once path below to match your server layout.
 * ───────────────────────────────────────────────────────────────
 */

require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/CrmApi.php';

// ── Pagination ────────────────────────────────────────────────────────────────
$currentPage = max(1, (int)($_GET['page'] ?? 1));
$perPage     = 9;   // how many posts per page

// ── Fetch blogs from CRM ──────────────────────────────────────────────────────
$result     = CrmApi::getBlogs($currentPage, $perPage);
$blogs      = $result['blogs']               ?? [];
$pagination = $result['pagination']          ?? [];
$totalPages = (int)($pagination['totalPages'] ?? 1);

// ── Page-level SEO ────────────────────────────────────────────────────────────
$baseUrl   = 'https://www.urologybymanmeet.com';
$canonical = $baseUrl . '/blog/' . ($currentPage > 1 ? '?page=' . $currentPage : '');

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Urology Health Blog | Expert Articles | Dr. Manmeet Singh</title>
  <meta name="description" content="Expert articles on kidney stones, prostate health, urinary disorders and more from Dr. Manmeet Singh, leading urologist in Lucknow.">
  <link rel="canonical" href="<?= htmlspecialchars($canonical) ?>">

  <!-- Pagination signals for Google -->
  <?php if ($currentPage > 1): ?>
    <link rel="prev" href="<?= htmlspecialchars($baseUrl . '/blog/?page=' . ($currentPage - 1)) ?>">
  <?php endif; ?>
  <?php if ($currentPage < $totalPages): ?>
    <link rel="next" href="<?= htmlspecialchars($baseUrl . '/blog/?page=' . ($currentPage + 1)) ?>">
  <?php endif; ?>

  <!-- === Paste your existing <link> and <style> tags below === -->
</head>
<body>

  <!-- === Paste your existing header/nav include below === -->
  <?php /* include $_SERVER['DOCUMENT_ROOT'] . '/includes/header.php'; */ ?>

  <main>
    <section class="blog-archive">
      <div class="container">

        <h1>Health Articles &amp; Guides</h1>
        <p class="section-subtitle">Expert insights from Dr. Manmeet Singh, Urologist</p>

        <?php if (empty($blogs)): ?>

          <p class="blog-empty">No articles published yet. Please check back soon.</p>

        <?php else: ?>

          <div class="blog-grid">
            <?php foreach ($blogs as $blog): ?>

              <article class="blog-card">

                <!-- Featured image (null-safe) -->
                <?php if (!empty($blog['featuredImage'])): ?>
                  <a href="/blog/<?= htmlspecialchars($blog['slug']) ?>/">
                    <img
                      src="<?= htmlspecialchars($blog['featuredImage']) ?>"
                      alt="<?= htmlspecialchars($blog['title']) ?>"
                      loading="lazy"
                      width="800" height="450"
                    >
                  </a>
                <?php endif; ?>

                <div class="blog-card__body">

                  <h2>
                    <a href="/blog/<?= htmlspecialchars($blog['slug']) ?>/">
                      <?= htmlspecialchars($blog['title']) ?>
                    </a>
                  </h2>

                  <?php if (!empty($blog['excerpt'])): ?>
                    <p class="blog-card__excerpt">
                      <?= htmlspecialchars($blog['excerpt']) ?>
                    </p>
                  <?php endif; ?>

                  <div class="blog-card__meta">
                    <span><?= htmlspecialchars($blog['author']) ?></span>
                    &middot;
                    <time datetime="<?= htmlspecialchars($blog['publishedAt']) ?>">
                      <?= date('F j, Y', strtotime($blog['publishedAt'])) ?>
                    </time>
                  </div>

                  <a href="/blog/<?= htmlspecialchars($blog['slug']) ?>/" class="read-more">
                    Read Article &rarr;
                  </a>

                </div>
              </article>

            <?php endforeach; ?>
          </div>

          <!-- Pagination -->
          <?php if ($totalPages > 1): ?>
            <nav class="pagination" aria-label="Blog pagination">
              <?php if ($currentPage > 1): ?>
                <a href="/blog/?page=<?= $currentPage - 1 ?>">&larr; Newer</a>
              <?php endif; ?>

              <span>Page <?= $currentPage ?> of <?= $totalPages ?></span>

              <?php if ($currentPage < $totalPages): ?>
                <a href="/blog/?page=<?= $currentPage + 1 ?>">Older &rarr;</a>
              <?php endif; ?>
            </nav>
          <?php endif; ?>

        <?php endif; ?>

      </div>
    </section>
  </main>

  <!-- === Paste your existing footer include below === -->
  <?php /* include $_SERVER['DOCUMENT_ROOT'] . '/includes/footer.php'; */ ?>

</body>
</html>
