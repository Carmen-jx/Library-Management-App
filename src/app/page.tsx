import Link from 'next/link';
import { BookOpen, Sparkles, Users, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Sparkles,
    title: 'Smart Recommendations',
    description:
      'Get AI-powered book suggestions tailored to your reading history, favorite genres, and what your connections are enjoying.',
  },
  {
    icon: BookOpen,
    title: 'Easy Management',
    description:
      'Borrow, return, and track books effortlessly. Keep your reading history organized and never lose track of a due date.',
  },
  {
    icon: Users,
    title: 'Social Reading',
    description:
      'Connect with fellow readers, share your favorite books, and discover what others in the community are reading.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-geist-sans)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-indigo-50" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32 lg:py-40 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-8">
            <Sparkles className="h-4 w-4" />
            Powered by AI
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Your Personal Library,
            <br />
            <span className="text-indigo-600">Reimagined</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            Discover your next favorite read with AI-powered recommendations.
            Manage your books, track your reading journey, and connect with a
            community of readers -- all in one modern platform.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to manage your reading
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A complete library experience, from discovery to community.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50">
                  <Icon className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-sm text-gray-500">
            Manos Library. Built with Next.js, Supabase, and OpenAI.
          </p>
        </div>
      </footer>
    </div>
  );
}
