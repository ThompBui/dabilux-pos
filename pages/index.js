// pages/index.js
import dynamic from 'next/dynamic';
import React from 'react';

const PosSystemClient = dynamic(
  () => import('../components/PosSystemContent'),
  { ssr: false } // Rất quan trọng: không render ở phía server
);

export default function Home() {
  return <PosSystemClient />;
}