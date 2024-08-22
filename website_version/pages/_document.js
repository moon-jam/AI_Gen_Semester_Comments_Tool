import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        {/* 如果使用 .ico 文件，請使用以下代碼 */}
        {/* <link rel="icon" href="/favicon.ico" type="image/x-icon" /> */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
