'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

// --- Color Palette ---

const GENRE_COLORS = [
  '#4f46e5', // indigo-600
  '#0891b2', // cyan-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#2563eb', // blue-600
  '#ca8a04', // yellow-600
  '#16a34a', // green-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
];

// --- Borrows Over Time ---

interface BorrowsOverTimeChartProps {
  data: { date: string; count: number }[];
}

export function BorrowsOverTimeChart({ data }: BorrowsOverTimeChartProps) {
  return (
    <Card>
      <Card.Header>
        <h3 className="text-base font-semibold text-gray-900">Borrows Over Time</h3>
      </Card.Header>
      <Card.Body>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">
            No borrow data available yet.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    fontSize: '13px',
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#4f46e5', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                  name="Borrows"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

// --- Popular Genres ---

interface PopularGenresChartProps {
  data: { genre: string; count: number }[];
}

export function PopularGenresChart({ data }: PopularGenresChartProps) {
  return (
    <Card>
      <Card.Header>
        <h3 className="text-base font-semibold text-gray-900">Popular Genres</h3>
      </Card.Header>
      <Card.Body>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">
            No genre data available yet.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="genre"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    fontSize: '13px',
                  }}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Bar dataKey="count" name="Books" radius={[0, 4, 4, 0]} barSize={20}>
                  {data.map((_, index) => (
                    <Cell
                      key={`genre-cell-${index}`}
                      fill={GENRE_COLORS[index % GENRE_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

// --- Top Books ---

interface TopBooksChartProps {
  data: { title: string; borrow_count: number }[];
}

export function TopBooksChart({ data }: TopBooksChartProps) {
  return (
    <Card>
      <Card.Header>
        <h3 className="text-base font-semibold text-gray-900">Most Borrowed Books</h3>
      </Card.Header>
      <Card.Body>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">
            No borrow data available yet.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="title"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  tickFormatter={(value: string) =>
                    value.length > 20 ? `${value.slice(0, 18)}...` : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    fontSize: '13px',
                  }}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Bar
                  dataKey="borrow_count"
                  name="Times Borrowed"
                  fill="#4f46e5"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

// --- Metric Card ---

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  accentColor?: string;
}

export function MetricCard({ label, value, subtitle, icon, className, accentColor }: MetricCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <Card.Body>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className={cn('mt-1 text-2xl font-bold', accentColor ?? 'text-gray-900')}>
              {value}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
              {icon}
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

// --- Search Queries Table ---

interface SearchQueriesTableProps {
  data: { query: string; count: number }[];
}

export function SearchQueriesTable({ data }: SearchQueriesTableProps) {
  return (
    <Card>
      <Card.Header>
        <h3 className="text-base font-semibold text-gray-900">Top Search Queries</h3>
      </Card.Header>
      <Card.Body>
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No search data available yet.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-gray-500">Query</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Searches</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={item.query} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-500">
                          {idx + 1}
                        </span>
                        <span className="truncate text-gray-900">{item.query}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-medium text-gray-700">
                      {item.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

// --- AI vs Normal Search Chart ---

interface AISearchChartProps {
  aiCount: number;
  normalCount: number;
}

export function AISearchChart({ aiCount, normalCount }: AISearchChartProps) {
  const data = [
    { name: 'AI Search', value: aiCount, fill: '#7c3aed' },
    { name: 'Normal Search', value: normalCount, fill: '#e5e7eb' },
  ];
  const total = aiCount + normalCount;

  return (
    <Card>
      <Card.Header>
        <h3 className="text-base font-semibold text-gray-900">AI vs Normal Search</h3>
      </Card.Header>
      <Card.Body>
        {total === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No search data available yet.
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      fontSize: '13px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-violet-600" />
                <span className="text-gray-600">AI Search</span>
                <span className="ml-auto font-semibold text-gray-900">{aiCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-gray-200" />
                <span className="text-gray-600">Normal Search</span>
                <span className="ml-auto font-semibold text-gray-900">{normalCount}</span>
              </div>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
