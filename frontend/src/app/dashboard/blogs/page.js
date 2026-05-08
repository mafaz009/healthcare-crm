'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth }     from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { blogsApi }    from '@/lib/blogs';
import { doctorsApi } from '@/lib/doctors';
import StatusBadge    from '@/components/ui/StatusBadge';
import Pagination     from '@/components/ui/Pagination';
import EmptyState     from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmModal   from '@/components/ui/ConfirmModal';
import toast          from 'react-hot-toast';
import { format }     from 'date-fns';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';

export default function BlogsPage() {
  const { user } = useAuth();
  const [blogs, setBlogs]               = useState([]);
  const [pagination, setPagination]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [doctors, setDoctors]           = useState([]);
  const [searchInput, setSearchInput]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // holds blog id to delete
  const [filters, setFilters]           = useState({ search: '', status: '', doctorId: '', page: 1 });

  const debouncedSearch = useDebounce(searchInput, 350);
  useEffect(() => {
    setFilters((f) => ({ ...f, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const fetchBlogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await blogsApi.getAll(params);
      setBlogs(data.data.blogs);
      setPagination(data.data.pagination);
    } catch { toast.error('Failed to load blogs'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchBlogs(); }, [fetchBlogs]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      doctorsApi.getAll({ limit: 100 }).then((r) => setDoctors(r.data.data.doctors)).catch(() => {});
    }
  }, [user]);

  const handleToggleStatus = async (blog) => {
    const newStatus = blog.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await blogsApi.setStatus(blog.id, newStatus);
      toast.success(newStatus === 'PUBLISHED' ? 'Blog published' : 'Blog unpublished');
      fetchBlogs();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (id) => {
    try {
      await blogsApi.remove(id);
      toast.success('Blog deleted');
      fetchBlogs();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blogs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage SEO content for doctor websites</p>
        </div>
        <Link href="/dashboard/blogs/new" className="btn-primary gap-2">
          <PlusIcon className="w-4 h-4" /> New Blog
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search title, keywords…"
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <select className="input w-auto" value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        {user?.role === 'SUPER_ADMIN' && (
          <select className="input w-auto" value={filters.doctorId}
            onChange={(e) => setFilters((f) => ({ ...f, doctorId: e.target.value, page: 1 }))}>
            <option value="">All Doctors</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">Title</th>
                    <th className="px-5 py-3 font-medium hidden md:table-cell">Slug</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    {user?.role === 'SUPER_ADMIN' && <th className="px-5 py-3 font-medium hidden lg:table-cell">Doctor</th>}
                    <th className="px-5 py-3 font-medium hidden lg:table-cell">Published</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {blogs.map((blog) => (
                    <tr key={blog.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 max-w-[260px]">
                        <p className="font-medium text-gray-900 truncate">{blog.title}</p>
                        {blog.metaDescription && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{blog.metaDescription}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell font-mono max-w-[160px] truncate">
                        {blog.slug}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={blog.status} /></td>
                      {user?.role === 'SUPER_ADMIN' && (
                        <td className="px-5 py-3 text-gray-500 hidden lg:table-cell">{blog.doctor?.name}</td>
                      )}
                      <td className="px-5 py-3 text-gray-400 hidden lg:table-cell text-xs">
                        {blog.publishedAt ? format(new Date(blog.publishedAt), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/blogs/${blog.id}/edit`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50">
                            <PencilIcon className="w-4 h-4" />
                          </Link>
                          <button onClick={() => handleToggleStatus(blog)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                            title={blog.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}>
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmDelete(blog.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {blogs.length === 0 && (
              <EmptyState title="No blogs yet"
                description="Create your first blog post to start publishing SEO content."
                action={<Link href="/dashboard/blogs/new" className="btn-primary">Create Blog Post</Link>}
              />
            )}
            <div className="px-5 py-4 border-t border-gray-100">
              <Pagination pagination={pagination} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        title="Delete Blog Post"
        message="This blog post will be permanently deleted and removed from all doctor websites. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
