'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { blogsApi }     from '@/lib/blogs';
import { useForm }      from 'react-hook-form';
import toast            from 'react-hot-toast';
import StatusBadge      from '@/components/ui/StatusBadge';
import LoadingSpinner   from '@/components/ui/LoadingSpinner';
import ImageUploader    from '@/components/ui/ImageUploader';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function EditBlogPage() {
  const { id }  = useParams();
  const router  = useRouter();

  const [blog, setBlog]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Image state — kept separate from react-hook-form because it's a File upload,
  // not a plain form field.
  const [imageFile, setImageFile]           = useState(null);   // newly selected File | null
  const [imageError, setImageError]         = useState(null);   // validation error | null
  const [existingImageUrl, setExistingImageUrl] = useState(null); // current DB path | null

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  // ── Load blog on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    blogsApi.getById(id)
      .then(({ data }) => {
        const b = data.data;
        setBlog(b);
        reset({
          title:           b.title,
          content:         b.content,
          seoTitle:        b.seoTitle        || '',
          metaDescription: b.metaDescription || '',
          keywords:        b.keywords        || '',
        });
        // Seed the image uploader with the stored path (e.g. "/uploads/123.webp")
        setExistingImageUrl(b.featuredImage || null);
      })
      .catch(() => {
        toast.error('Blog not found');
        router.push('/dashboard/blogs');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Called by ImageUploader on file selection or clear
  const handleImageChange = (file, error) => {
    setImageFile(file);
    setImageError(error);
    // If user cleared the newly staged file, restore the existing DB image display
    // (we don't delete from DB unless they explicitly save with a new image)
    if (file === null) setExistingImageUrl(blog?.featuredImage || null);
  };

  // ── Save changes ───────────────────────────────────────────────────────────
  const saveChanges = async (data) => {
    if (imageError) {
      toast.error(imageError);
      return;
    }

    try {
      await blogsApi.update(id, data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save changes');
      return;
    }

    if (imageFile) {
      try {
        const { data: imgRes } = await blogsApi.uploadImage(id, imageFile);
        // Update the local state so the preview reflects the newly stored path
        const newPath = imgRes.data?.featuredImage;
        if (newPath) {
          setExistingImageUrl(newPath);
          setBlog((b) => ({ ...b, featuredImage: newPath }));
        }
        setImageFile(null);
        setImageError(null);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Content saved but image upload failed. Try again.');
        return;
      }
    }

    setBlog((b) => ({ ...b, ...data }));
    toast.success('Changes saved');
  };

  // ── Publish / Unpublish toggle ─────────────────────────────────────────────
  const handleStatusToggle = async () => {
    const newStatus = blog.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setPublishing(true);
    try {
      await blogsApi.setStatus(id, newStatus);
      setBlog((b) => ({ ...b, status: newStatus }));
      toast.success(newStatus === 'PUBLISHED' ? 'Blog published!' : 'Blog unpublished');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl space-y-5">
      <button
        onClick={() => router.push('/dashboard/blogs')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeftIcon className="w-4 h-4" /> Back to Blogs
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Blog Post</h1>
          <p className="text-sm text-gray-500 font-mono mt-0.5">/{blog?.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={blog?.status} />
          <button
            onClick={handleStatusToggle}
            disabled={publishing}
            className={blog?.status === 'PUBLISHED' ? 'btn-secondary' : 'btn-primary'}
          >
            {publishing ? 'Updating…' : blog?.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <form className="space-y-5">

        {/* ── Content ── */}
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Content</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="input text-lg"
              {...register('title', { required: 'Required' })}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content *
              <span className="ml-2 text-xs font-normal text-gray-400">(HTML)</span>
            </label>
            <textarea
              rows={16}
              className="input font-mono text-sm resize-y"
              {...register('content', { required: 'Required' })}
            />
            {errors.content && (
              <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>
            )}
          </div>
        </div>

        {/* ── Featured image ── */}
        <div className="card p-6">
          <ImageUploader
            currentUrl={existingImageUrl}
            file={imageFile}
            error={imageError}
            onChange={handleImageChange}
          />
        </div>

        {/* ── SEO ── */}
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">SEO Settings</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Controls how the blog appears in Google.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SEO Title
              <span className="ml-2 text-xs font-normal text-gray-400">max 70 chars</span>
            </label>
            <input
              className="input"
              {...register('seoTitle', { maxLength: { value: 70, message: 'Max 70 chars' } })}
            />
            {errors.seoTitle && (
              <p className="text-xs text-red-500 mt-1">{errors.seoTitle.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description
              <span className="ml-2 text-xs font-normal text-gray-400">max 160 chars</span>
            </label>
            <textarea
              rows={2}
              className="input resize-none"
              {...register('metaDescription', {
                maxLength: { value: 160, message: 'Max 160 chars' },
              })}
            />
            {errors.metaDescription && (
              <p className="text-xs text-red-500 mt-1">{errors.metaDescription.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input className="input" {...register('keywords')} />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/blogs')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(saveChanges)}
            disabled={isSubmitting || !!imageError}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title={imageError ? 'Fix the image error above first' : undefined}
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </form>
    </div>
  );
}
