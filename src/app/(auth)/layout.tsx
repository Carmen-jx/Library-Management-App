import { BookOpen } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-indigo-600 text-white">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
            Manos Library
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your personal library companion
          </p>
        </div>

        {/* Card container */}
        <div className="rounded-xl bg-white px-6 py-8 shadow-sm ring-1 ring-gray-900/5 sm:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
