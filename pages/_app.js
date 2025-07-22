// pages/_app.js
import '../styles/globals.css';
import { Inter } from 'next/font/google';

// Cấu hình font
const inter = Inter({ 
  subsets: ['latin', 'vietnamese'],
  display: 'swap', 
});
function MyApp({ Component, pageProps }) {
  return (
    <main className={inter.className}>
      <Component {...pageProps} />
    </main>
  );
}

export default MyApp;