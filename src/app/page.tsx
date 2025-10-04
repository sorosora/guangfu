'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/guangfu');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">清淤地圖 - 光復計畫</h1>
        <p className="text-gray-600 mb-4">正在轉至地圖頁面...</p>
        <a
          href="/guangfu"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          前往地圖
        </a>
      </div>
    </div>
  );
}
