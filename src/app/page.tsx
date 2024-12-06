// pages/index.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import CodeReviewInterface from '@/components/CodeReviewInterface';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Code Review Assistant</title>
        <meta name="description" content="AI-powered code review assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <div> hi</div>
        <CodeReviewInterface />
      </main>
    </>
  );
};

export default Home;