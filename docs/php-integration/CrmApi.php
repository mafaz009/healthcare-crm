<?php
/**
 * CrmApi.php — Centralised helper for urologybymanmeet.com
 *
 * HOW TO USE
 * ----------
 * 1. Copy this file to your PHP website (e.g. /includes/CrmApi.php)
 * 2. Set the two constants below to match your live values
 * 3. Include it at the top of any page that needs CRM data:
 *       require_once __DIR__ . '/../includes/CrmApi.php';
 *
 * CACHING
 * -------
 * All GET requests are cached as flat JSON files in /tmp/crm_cache/.
 * Default TTL: 3600 seconds (1 hour).
 * To clear the cache manually, delete files from /tmp/crm_cache/
 * or call CrmApi::clearCache().
 */

// ── Configuration ─────────────────────────────────────────────────────────────
define('CRM_API_URL',  'https://api.youragency.com');   // your backend base URL
define('CRM_API_KEY',  'PASTE_YOUR_DOCTOR_API_KEY_HERE'); // from CRM → Doctors page
define('CRM_CACHE_DIR', sys_get_temp_dir() . '/crm_cache');
define('CRM_CACHE_TTL', 3600); // seconds — 1 hour

class CrmApi
{
    // ── Blog listing ──────────────────────────────────────────────────────────
    /**
     * Get a paginated list of published blogs.
     *
     * @param int $page   Page number (default 1)
     * @param int $limit  Posts per page (default 10, max 50)
     * @return array|null { blogs: [...], pagination: {...} }  or null on failure
     */
    public static function getBlogs(int $page = 1, int $limit = 10): ?array
    {
        $url = CRM_API_URL . '/api/public/blogs?' . http_build_query([
            'page'  => $page,
            'limit' => $limit,
        ]);
        return self::get($url);
    }

    // ── Single blog by slug ───────────────────────────────────────────────────
    /**
     * Get a single published blog post with full SEO package.
     *
     * @param string $slug  The URL slug (e.g. "kidney-stone-treatment")
     * @return array|null   { blog: {...}, seo: {...} }  or null on 404/failure
     */
    public static function getBlog(string $slug): ?array
    {
        $url = CRM_API_URL . '/api/public/blogs/' . urlencode($slug);
        return self::get($url);
    }

    // ── Submit appointment ────────────────────────────────────────────────────
    /**
     * Submit a booking form to the CRM. No caching — always hits the API.
     *
     * @param array $data  patientName, phone, email, preferredDate, preferredTime, issue
     * @return array { success: bool, message: string, data?: {...} }
     */
    public static function submitAppointment(array $data): array
    {
        $url = CRM_API_URL . '/api/public/appointments';

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data),
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'X-Api-Key: ' . CRM_API_KEY,
            ],
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $body  = curl_exec($ch);
        $errno = curl_errno($ch);
        curl_close($ch);

        if ($errno || $body === false) {
            return ['success' => false, 'message' => 'Could not reach booking server. Please call us directly.'];
        }

        $decoded = json_decode($body, true);
        return $decoded ?? ['success' => false, 'message' => 'Invalid response from server.'];
    }

    // ── Cache management ──────────────────────────────────────────────────────
    public static function clearCache(): void
    {
        if (!is_dir(CRM_CACHE_DIR)) return;
        foreach (glob(CRM_CACHE_DIR . '/*.json') as $file) {
            unlink($file);
        }
    }

    // ── Internal GET with file-cache ──────────────────────────────────────────
    private static function get(string $url): ?array
    {
        $cacheFile = self::cacheFile($url);

        // Return cached response if it exists and is fresh
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < CRM_CACHE_TTL) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if ($cached !== null) return $cached;
        }

        // Fetch from API
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'X-Api-Key: ' . CRM_API_KEY,
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno  = curl_errno($ch);
        curl_close($ch);

        if ($errno || $body === false || $status !== 200) return null;

        $response = json_decode($body, true);
        if (!isset($response['data'])) return null;

        // Write to cache
        self::ensureCacheDir();
        file_put_contents($cacheFile, json_encode($response['data']));

        return $response['data'];
    }

    private static function cacheFile(string $url): string
    {
        return CRM_CACHE_DIR . '/' . md5($url) . '.json';
    }

    private static function ensureCacheDir(): void
    {
        if (!is_dir(CRM_CACHE_DIR)) {
            mkdir(CRM_CACHE_DIR, 0755, true);
        }
    }
}
