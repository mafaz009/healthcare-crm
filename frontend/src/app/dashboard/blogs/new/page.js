'use client';
import { useState, useEffect } from 'react';
import { useRouter }    from 'next/navigation';
import { useAuth }      from '@/hooks/useAuth';
import { blogsApi }     from '@/lib/blogs';
import { doctorsApi }   from '@/lib/doctors';
import { useForm }      from 'react-hook-form';
import toast            from 'react-hot-toast';
import ImageUploader    from '@/components/ui/ImageUploader';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function NewBlogPage() {
  const router   = useRouter();
  const { user } = useAuth();

  const [doctors, setDoctors]   = useState([]);
  const [imageFile, setImageFile]   = useState(null);   // File object | null
  const [imageError, setImageError] = useState(null);   // validation error | null
  const [publishing, setPublishing] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { status: 'DRAFT' },
  });

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      doctorsApi.getAll({ limit: 100 })
        .then((r) => setDoctors(r.data.data.doctors))
        .catch(() => {});
    }
  }, [user]);

  // Called by ImageUploader on every selection or clear
  const handleImageChange = (file, error) => {
    setImageFile(file);
    setImageError(error);
  };

  // ── Save as draft ──────────────────────────────────────────────────────────
  const saveDraft = async (data) => {
    // Block if client-side validation failed
    if (imageError) {
      toast.error(imageError);
      return;
    }

    let createdId = null;
    try {
      const { data: res } = await blogsApi.create(data);
      createdId = res.data.id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save draft');
      return;
    }

    if (imageFile) {
      try {
        await blogsApi.uploadImage(createdId, imageFile);
      } catch (err) {
        // Draft is saved — navigate to edit page so user can retry the image upload
        toast.error(
          err.response?.data?.message ||
          'Draft saved but image upload failed. Re-upload from the edit page.'
        );
        router.push(`/dashboard/blogs/${createdId}/edit`);
        return;
      }
    }

    toast.success('Draft saved');
    router.push(`/dashboard/blogs/${createdId}/edit`);
  };

  // ── Save and publish ───────────────────────────────────────────────────────
  const saveAndPublish = async (data) => {
    if (imageError) {
      toast.error(imageError);
      return;
    }

    setPublishing(true);
    let createdId = null;

    try {
      const { data: res } = await blogsApi.create(data);
      createdId = res.data.id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create blog');
      setPublishing(false);
      return;
    }

    if (imageFile) {
      try {
        await blogsApi.uploadImage(createdId, imageFile);
      } catch (err) {
        toast.error(
          err.response?.data?.message ||
          'Image upload failed. Blog saved as draft — publish after re-uploading the image.'
        );
        router.push(`/dashboard/blogs/${createdId}/edit`);
        setPublishing(false);
        return;
      }
    }

    try {
      await blogsApi.setStatus(createdId, 'PUBLISHED');
      toast.success('Blog published!');
      router.push('/dashboard/blogs');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish. Blog saved as draft.');
      router.push(`/dashboard/blogs/${createdId}/edit`);
    } finally {
      setPublishing(false);
    }
  };

  const title = watch('title');

  return (
    <div className="max-w-4xl space-y-5">
      <button
        onClick={() => router.push('/dashboard/blogs')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeftIcon className="w-4 h-4" /> Back to Blogs
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Blog Post</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fill in the content and SEO details below.</p>
      </div>

      <form className="space-y-5">

        {/* ── Content ── */}
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Content</h2>

          {user?.role === 'SUPER_ADMIN' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
              <select className="input" {...register('doctorId', { required: 'Required' })}>
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {errors.doctorId && (
                <p className="text-xs text-red-500 mt-1">{errors.doctorId.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="input text-lg"
              placeholder="e.g. How to Manage Diabetes Through Diet"
              {...register('title', { required: 'Title is required' })}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
            )}
            {title && (
              <p className="text-xs text-gray-400 mt-1">
                Slug will be auto-generated from this title
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content *
              <span className="ml-2 text-xs font-normal text-gray-400">(HTML accepted)</span>
            </label>
            <textarea
              rows={16}
              className="input font-mono text-sm resize-y"
              placeholder="<p>Write your blog content here…</p>"
              {...register('content', { required: 'Content is required' })}
            />
            {errors.content && (
              <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              💡 For rich editing, integrate TipTap or TinyMCE by replacing this textarea.
            </p>
          </div>
        </div>

        {/* ── Featured image ── */}
        <div className="card p-6">
          <ImageUploader
            currentUrl={null}
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
              These fields control how the blog appears in Google search results.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SEO Title
              <span className="ml-2 text-xs font-normal text-gray-400">max 70 characters</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Manage Diabetes Through Diet | Dr. Smith"
              {...register('seoTitle', { maxLength: { value: 70, message: 'Max 70 characters' } })}
            />
            {errors.seoTitle && (
              <p className="text-xs text-red-500 mt-1">{errors.seoTitle.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description
              <span className="ml-2 text-xs font-normal text-gray-400">max 160 characters</span>
            </label>
            <textarea
              rows={2}
              className="input resize-none"
              placeholder="Concise description shown in Google search results…"
              {...register('metaDescription', {
                maxLength: { value: 160, message: 'Max 160 characters' },
              })}
            />
            {errors.metaDescription && (
              <p className="text-xs text-red-500 mt-1">{errors.metaDescription.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keywords
              <span className="ml-2 text-xs font-normal text-gray-400">comma separated</span>
            </label>
            <input
              className="input"
              placeholder="diabetes diet, manage diabetes, blood sugar"
              {...register('keywords')}
            />
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
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isSubmitting || !!imageError}
              onClick={handleSubmit(saveDraft)}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              title={imageError ? 'Fix the image error above first' : undefined}
            >
              {isSubmitting ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              type="button"
              disabled={publishing || !!imageError}
              onClick={handleSubmit(saveAndPublish)}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              title={imageError ? 'Fix the image error above first' : undefined}
            >
              {publishing ? 'Publishing…' : 'Publish Now'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
