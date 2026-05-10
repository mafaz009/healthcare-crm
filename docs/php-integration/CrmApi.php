<?php
/**
 * CrmApi.php — Centralized CRM API client for doctor websites
 * ─────────────────────────────────────────────────────────────
 * WHERE THIS FILE GOES:
 *   Upload to: /includes/CrmApi.php  (or any shared include directory)
 *
 * HOW TO USE IN ANY PHP PAGE:
 *   require_once '/path/to/includes/CrmApi.php';
 *
 *   $blogs = CrmApi::getBlogs();
 *   $post  = CrmApi::getBlogBySlug('kidney-stone-treatment');
 *
 * ─────────────────────────────────────────────────────────────
 * CONFIGURE THE TWO LINES BELOW BEFORE UPLOADING
 * ─────────────────────────────────────────────────────────────
 */
define('CRM_API_BASE', 'https://api.youragency.com');    // your live backend URL
define('CRM_API_KEY',  'PASTE_YOUR_DOCTOR_API_KEY_HERE'); // from CRM → Doctors page

/**
 * Optional: file-based cache settings
 * Cache stores API responses as JSON files so the website
 * doesn't hit the CRM on every single page load.
 *
 * CACHE_DIR: must be writable by the web server (PHP's sys_get_temp_dir() works on all hosts)
 * CACHE_TTL:  seconds before a cached response is considered stale (3600 = 1 hour)
 */
define('CRM_CACHE_DIR', sys_get_temp_dir() . '/crm_cache');
define('CRM_CACHE_TTL', 3600);


class CrmApi
{
    // ─────────────────────────────────────────────────────────────
    // PUBLIC METHODS
    // ─────────────────────────────────────────────────────────────

    /**
     * Get a paginated list of published blogs.
     *
     * @param  int        $page   Page number (starts at 1)
     * @param  int        $limit  Posts per page (max 50)
     * @return array|null         { blogs: [...], pagination: {...} } or null on failure
     *
     * Example:
     *   $result = CrmApi::getBlogs(1, 9);
     *   foreach ($result['blogs'] as $blog) {
     *       echo $blog['title'];
     *       echo $blog['excerpt'];
     *       echo $blog['featuredImage'];  // absolute URL or null
     *   }
     */
    public static function getBlogs(int $page = 1, int $limit = 10): ?array
    {
        $url = CRM_API_BASE . '/api/public/blogs?' . http_build_query([
            'page'  => $page,
            'limit' => min($limit, 50),
        ]);
        return self::cachedGet($url);
    }

    /**
     * Get a single published blog post by its URL slug.
     * Returns full content + complete SEO package.
     *
     * @param  string     $slug  The URL slug (e.g. "kidney-stone-treatment")
     * @return array|null        { blog: {...}, seo: {...} } or null if not found
     *
     * Example:
     *   $result = CrmApi::getBlogBySlug('kidney-stone-treatment');
     *   if (!$result) { http_response_code(404); exit; }
     *   $blog = $result['blog'];
     *   $seo  = $result['seo'];
     */
    public static function getBlogBySlug(string $slug): ?array
    {
        $slug = preg_replace('/[^a-z0-9-]/', '', strtolower(trim($slug, '/')));
        if (empty($slug)) return null;

        $url = CRM_API_BASE . '/api/public/blogs/' . $slug;
        return self::cachedGet($url);
    }

    /**
     * Clear all cached responses.
     * Call this after publishing a new blog if you don't want to wait for TTL.
     */
    public static function clearCache(): void
    {
        if (!is_dir(CRM_CACHE_DIR)) return;
        foreach (glob(CRM_CACHE_DIR . '/*.json') as $file) {
            unlink($file);
        }
    }


    // ─────────────────────────────────────────────────────────────
    // INTERNAL METHODS
    // ─────────────────────────────────────────────────────────────

    /**
     * Fetch a URL, returning the cached result if available and fresh.
     */
    private static function cachedGet(string $url): ?array
    {
        $cacheFile = CRM_CACHE_DIR . '/' . md5($url) . '.json';

        // Serve from cache if the file exists and is not stale
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < CRM_CACHE_TTL) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if ($cached !== null) return $cached;
        }

        // Fetch live from API
        $data = self::fetch($url);
        if ($data === null) return null;

        // Write to cache (create directory if needed)
        if (!is_dir(CRM_CACHE_DIR)) {
            mkdir(CRM_CACHE_DIR, 0755, true);
        }
        file_put_contents($cacheFile, json_encode($data), LOCK_EX);

        return $data;
    }

    /**
     * Make a GET request to the CRM API using X-Api-Key header.
     * Returns the decoded `data` payload, or null on any failure.
     */
    private static function fetch(string $url): ?array
    {
        if (!function_exists('curl_init')) {
            error_log('[CrmApi] cURL is not available on this server.');
            return null;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'X-Api-Key: ' . CRM_API_KEY,
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT        => 8,          // fail fast — don't hang the page
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 2,
        ]);

        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno  = curl_errno($ch);
        curl_close($ch);

        // Network failure
        if ($errno || $body === false) {
            error_log('[CrmApi] cURL error ' . $errno . ' fetching: ' . $url);
            return null;
        }

        // Non-200 (404 is expected for unpublished/missing slugs — log quietly)
        if ($status === 404) return null;
        if ($status !== 200) {
            error_log('[CrmApi] HTTP ' . $status . ' fetching: ' . $url);
            return null;
        }

        $decoded = json_decode($body, true);
        if (!isset($decoded['data'])) {
            error_log('[CrmApi] Unexpected response shape from: ' . $url);
            return null;
        }

        return $decoded['data'];
    }
}
