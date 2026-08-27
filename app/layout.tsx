/* eslint-disable @next/next/next-script-for-ga */
import type { Metadata } from 'next';
import './globals.css';
import './auth-styles.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://studio.inchframe.com';

export const metadata:Metadata={metadataBase:new URL(siteUrl),title:{default:'Inchframe Studio | Directed AI Video Production',template:'%s | Inchframe Studio'},description:'AI-assisted video production for artists and brands—directed, reviewed, revised, and delivered through the Inchframe production workflow.',icons:{icon:'/favicon.png',apple:'/favicon.png'},openGraph:{type:'website',title:'INCHFRAME STUDIO',description:'A finished film. Not another tool.',url:siteUrl,images:[{url:'/og.png',width:1200,height:630,alt:'Inchframe Studio — A finished film. Not another tool.'}]},twitter:{card:'summary_large_image',title:'INCHFRAME STUDIO',description:'A finished film. Not another tool.',images:['/og.png']}};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><script type="text/javascript" dangerouslySetInnerHTML={{__html:`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "y7ifovxot8");`}}/><script async src="https://www.googletagmanager.com/gtag/js?id=G-KQCZ8BM990"/><script dangerouslySetInnerHTML={{__html:`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-KQCZ8BM990');`}}/></head><body>{children}</body></html>;}
