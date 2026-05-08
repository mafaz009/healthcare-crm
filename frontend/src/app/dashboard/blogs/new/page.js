'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth }   from '@/hooks/useAuth';
import { blogsApi }  from '@/lib/blogs';
import { doctorsApi } from '@/lib/doctors';
import { useForm }   from 'react-hook-form';
import toast         from 'react-hot-toast';
import { ArrowLeftIcon, PhotoIcon } from '@heroicons/react/24/outline';

export default function NewBlogPage() {
  const router     = useRouter();
  const { user }   = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [blogId, setBlogId]   = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { status: 'DRAFT' },
  });

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      doctorsApi.getAll({ limit: 100 }).then((r) => setDoctors(r.data.data.doctors)).catch(() => {});
    }
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveDraft = async (data) => {
    try {
      const { data: res } = await blogsApi.create(data);
      const id = res.data.id;
      setBlogId(id);

      if (imageFile) {
        await blogsApi.uploadImage(id, imageFile);
      }

      toast.success('Draft saved');
      router.push(`/dashboard/blogs/${id}/edit`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const saveAndPublish = async (data) => {
    setPublishing(true);
    try {
      const { data: res } = await blogsApi.create(data);
      const id = res.data.id;

      if (imageFile) await blogsApi.uploadImage(id, imageFile);
      await blogsApi.setStatus(id, 'PUBLISHED');

      toast.success('Blog published!');
      router.push('/dashboard/blogs');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const title = watch('title');

  return (
    <div className="max-w-4xl space-y-5">
      <button onClick={() => router.push('/dashboard/blogs')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Blogs
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Blog Post</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fill in the content and SEO details below.</p>
      </div>

      <form className="space-y-5">
        {/* Main content */}
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Content</h2>

          {user?.role === 'SUPER_ADMIN' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
              <select className="input" {...register('doctorId', { required: 'Required' })}>
                <option value="">Select doctor</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.doctorId && <p className="text-xs text-red-500 mt-1">{errors.doctorId.message}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input className="input text-lg" placeholder="e.g. How to Manage Diabetes Through Diet"
              {...register('title', { required: 'Title is required' })} />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
            {title && <p className="text-xs text-gray-400 mt-1">Slug will be auto-generated from this title</p>}
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
            {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>}
            <p className="text-xs text-gray-400 mt-1">
              💡 Tip: For rich editing, integrate TipTap or TinyMCE by replacing this textarea.
            </p>
          </div>
        </div>

        {/* Featured image */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Featured Image</h2>
          <div className="flex items-start gap-4">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-32 h-24 object-cover rounded-xl border border-gray-200" />
            ) : (
              <div className="w-32 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                <PhotoIcon className="w-8 h-8 text-gray-300" />
              </div>
            )}
            <div>
              <label className="btn-secondary cursor-pointer">
                {imagePreview ? 'Change Image' : 'Upload Image'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
              <p className="text-xs text-gray-400 mt-2">JPEG, PNG, WebP · Max 5MB</p>
            </div>
          </div>
        </div>

        {/* SEO */}
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">SEO Settings</h2>
            <p className="text-xs text-gray-400 mt-0.5">These fields control how the blog appears in Google search results.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SEO Title
              <span className="ml-2 text-xs font-normal text-gray-400">max 70 characters</span>
            </label>
            <input className="input" placeholder="e.g. Manage Diabetes Through Diet | Dr. Smith"
              {...register('seoTitle', { maxLength: { value: 70, message: 'Max 70 characters' } })} />
            {errors.seoTitle && <p className="text-xs text-red-500 mt-1">{errors.seoTitle.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description
              <span className="ml-2 text-xs font-normal text-gray-400">max 160 characters</span>
            </label>
            <textarea rows={2} className="input resize-none"
              placeholder="Concise description shown in Google search results…"
              {...register('metaDescription', { maxLength: { value: 160, message: 'Max 160 characters' } })} />
            {errors.metaDescription && <p className="text-xs text-red-500 mt-1">{errors.metaDescription.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keywords
              <span className="ml-2 text-xs font-normal text-gray-400">comma separated</span>
            </label>
            <input className="input" placeholder="diabetes diet, manage diabetes, blood sugar"
              {...register('keywords')} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => router.push('/dashboard/blogs')} className="btn-secondary">
            Cancel
          </button>
          <div className="flex gap-3">
            <button type="button" disabled={isSubmitting}
              onClick={handleSubmit(saveDraft)} className="btn-secondary">
              {isSubmitting ? 'Saving…' : 'Save as Draft'}
            </button>
            <button type="button" disabled={publishing}
              onClick={handleSubmit(saveAndPublish)} className="btn-primary">
              {publishing ? 'Publishing…' : 'Publish Now'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
