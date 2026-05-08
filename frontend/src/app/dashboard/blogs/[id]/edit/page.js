'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { blogsApi } from '@/lib/blogs';
import { useForm }  from 'react-hook-form';
import toast        from 'react-hot-toast';
import StatusBadge  from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ArrowLeftIcon, PhotoIcon } from '@heroicons/react/24/outline';

export default function EditBlogPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const [blog, setBlog]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    blogsApi.getById(id)
      .then(({ data }) => {
        const b = data.data;
        setBlog(b);
        reset({
          title: b.title, content: b.content,
          seoTitle: b.seoTitle || '', metaDescription: b.metaDescription || '', keywords: b.keywords || '',
        });
        if (b.featuredImage) setImagePreview(b.featuredImage);
      })
      .catch(() => { toast.error('Blog not found'); router.push('/dashboard/blogs'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveChanges = async (data) => {
    try {
      await blogsApi.update(id, data);
      if (imageFile) await blogsApi.uploadImage(id, imageFile);
      toast.success('Changes saved');
      setBlog((b) => ({ ...b, ...data }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = blog.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setPublishing(true);
    try {
      await blogsApi.setStatus(id, newStatus);
      setBlog((b) => ({ ...b, status: newStatus }));
      toast.success(newStatus === 'PUBLISHED' ? 'Blog published!' : 'Blog unpublished');
    } catch { toast.error('Failed to update status'); }
    finally { setPublishing(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl space-y-5">
      <button onClick={() => router.push('/dashboard/blogs')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Blogs
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Blog Post</h1>
          <p className="text-sm text-gray-500 font-mono mt-0.5">/{blog?.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={blog?.status} />
          <button onClick={handleStatusToggle} disabled={publishing}
            className={blog?.status === 'PUBLISHED' ? 'btn-secondary' : 'btn-primary'}>
            {publishing ? 'Updating…' : blog?.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <form className="space-y-5">
        {/* Content */}
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Content</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input className="input text-lg" {...register('title', { required: 'Required' })} />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content * <span className="text-xs font-normal text-gray-400">(HTML)</span>
            </label>
            <textarea rows={16} className="input font-mono text-sm resize-y"
              {...register('content', { required: 'Required' })} />
          </div>
        </div>

        {/* Featured image */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Featured Image</h2>
          <div className="flex items-start gap-4">
            {imagePreview ? (
              <img src={imagePreview.startsWith('blob:') ? imagePreview : `${process.env.NEXT_PUBLIC_API_URL}${imagePreview}`}
                alt="Preview" className="w-32 h-24 object-cover rounded-xl border border-gray-200" />
            ) : (
              <div className="w-32 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                <PhotoIcon className="w-8 h-8 text-gray-300" />
              </div>
            )}
            <label className="btn-secondary cursor-pointer">
              Change Image
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        {/* SEO */}
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">SEO Settings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Controls how the blog appears in Google.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title <span className="text-xs font-normal text-gray-400">max 70 chars</span></label>
            <input className="input" {...register('seoTitle', { maxLength: { value: 70, message: 'Max 70 chars' } })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description <span className="text-xs font-normal text-gray-400">max 160 chars</span></label>
            <textarea rows={2} className="input resize-none" {...register('metaDescription', { maxLength: { value: 160, message: 'Max 160 chars' } })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input className="input" {...register('keywords')} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => router.push('/dashboard/blogs')} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSubmit(saveChanges)} disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
