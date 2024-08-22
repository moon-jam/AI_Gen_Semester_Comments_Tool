import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <title>學期評語生成器</title>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <meta name="description" content="自動生成學生學期評語的工具，簡單方便，適合教師使用。" />
        <meta name="keywords" content="學期評語生成, 學生評語, 教師工具, AI 評語生成" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
