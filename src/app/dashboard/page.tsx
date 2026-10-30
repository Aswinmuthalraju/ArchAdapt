'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navigation/Navbar';
import { Plus, MapPin, Trash2, ArrowRight } from 'lucide-react';
import { Project } from '@/types/architectural';
import { supabase, getCurrentAppUser } from '@/lib/supabase/client';
import { getUserProjectsFromSupabase, deleteProjectFromSupabase } from '@/lib/services/projectService';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Listen for sign out while on dashboard
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
      }
    });

    async function loadUserProjects() {
      setLoading(true);
      setLoadError(null);
      const loaded: Project[] = [];

      try {
        const appUser = await getCurrentAppUser();
        if (!appUser) {
          router.replace('/login');
          return;
        }

        if (!cancelled) setSignedIn(true);

        if (!appUser.isGuest) {
          try {
            const dbProjects = await getUserProjectsFromSupabase(appUser.id);
            loaded.push(...dbProjects.map((project) => ({ ...project, storage: 'supabase' as const })));
          } catch {
            if (!cancelled) setLoadError('Your account projects could not be loaded.');
          }
        }
      } catch {
        router.replace('/login');
        return;
      }

      // Also include any offline projects saved in this browser
      try {
        Object.keys(localStorage).filter((key) => key.startsWith('project_')).forEach((key) => {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '');
            if (item?.id && Array.isArray(item.versions) && !loaded.some((project) => project.id === item.id)) loaded.push({ ...item, storage: 'local' });
          } catch { /* skip unreadable entries */ }
        });
      } catch { /* localStorage unavailable */ }

      if (cancelled) return;
      loaded.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      setProjects(loaded);
      setLoading(false);
    }

    loadUserProjects();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Delete "${project.title}" and all of its versions? This cannot be undone.`)) return;
    if (project.storage === 'supabase') {
      const deleted = await deleteProjectFromSupabase(project.id);
      if (!deleted) {
        setLoadError(`"${project.title}" could not be deleted from your account.`);
        return;
      }
    }
    try {
      localStorage.removeItem(`project_${project.id}`);
      localStorage.removeItem(`chat_${project.id}`);
    } catch { /* localStorage unavailable */ }
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  };

  return (
    <div className="min-h-screen bg-[#FBF8F4] text-stone-900">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 lg:px-12 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-8 mb-12 gap-6">
          <div>
            <span className="text-xs text-magenta-500">Architectural Studio Workspace</span>
            <h1 className="font-serif text-4xl font-normal text-stone-950 mt-1">My Projects</h1>
          </div>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 btn-gem px-6 py-3.5 text-sm font-semibold text-white transition-all shadow-md self-start sm:self-auto"
          >
            <Plus className="h-4 w-4 text-magenta-400" />
            Create New Project
          </Link>
        </div>

        {loadError && (
          <div className="mb-8 border border-red-300 bg-red-50 px-4 py-3 font-sans text-xs text-red-700">{loadError}</div>
        )}

        {loading ? (
          <div className="text-center text-xs text-stone-500 py-12">
            Loading your projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="border border-stone-300 bg-white p-12 text-center space-y-4">
            <h2 className="font-serif text-2xl text-stone-900">No projects yet</h2>
            <p className="font-sans text-sm text-stone-600 max-w-lg mx-auto">
              {signedIn
                ? 'Create a project to generate a floor plan and 3D model from your plot and requirements.'
                : 'Create a project to generate a floor plan and 3D model. Sign in first if you want it saved to your account; otherwise it is kept in this browser.'}
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-magenta-500 px-8 py-3.5 font-sans text-xs font-semibold text-white hover:bg-magenta-600 transition-all"
            >
              Create Your First Project
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div
                key={project.id}
                className="border border-stone-300 bg-white p-6 shadow-sm hover:border-stone-900 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 mb-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-magenta-500" />
                      {project.location?.city}, {project.location?.country}
                    </span>
                    <span className="bg-stone-100 px-2 py-0.5 font-bold text-stone-700">
                      {project.versions?.length || 0} {(project.versions?.length || 0) === 1 ? 'version' : 'versions'}
                    </span>
                  </div>

                  <h3 className="font-serif text-xl font-medium text-stone-900 group-hover:text-magenta-600 transition-colors">
                    {project.title}
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-stone-600">
                    <span className="bg-[#F4F1EA] px-2.5 py-1 border border-stone-200">
                      Style: {project.preferences?.primaryStyle || 'Modern'}
                    </span>
                    <span className="bg-[#F4F1EA] px-2.5 py-1 border border-stone-200">
                      Plot: {project.siteInfo?.plotWidth}' × {project.siteInfo?.plotDepth}'
                    </span>
                    <span className="bg-[#F4F1EA] px-2.5 py-1 border border-stone-200">
                      {project.storage === 'supabase' ? 'Saved to account' : 'This browser only'}
                    </span>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-stone-200 flex items-center justify-between">
                  <button
                    onClick={() => handleDelete(project)}
                    className="text-stone-400 hover:text-red-600 transition-colors p-1"
                    title="Delete Project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <Link
                    href={`/workspace/${project.id}`}
                    className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-stone-900 hover:text-magenta-500 transition-colors"
                  >
                    Open Workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
