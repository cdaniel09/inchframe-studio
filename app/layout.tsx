import type { Metadata } from 'next';
import './globals.css';
import './auth-styles.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://studio.inchframe.com';

export const metadata:Metadata={metadataBase:new URL(siteUrl),title:{default:'Inchframe Studio | Directed AI Video Production',template:'%s | Inchframe Studio'},description:'AI-assisted video production for artists and brands—directed, reviewed, revised, and delivered through the Inchframe production workflow.',icons:{icon:'/favicon.png',apple:'/favicon.png'},openGraph:{type:'website',title:'INCHFRAME STUDIO',description:'A finished film. Not another tool.',url:siteUrl,images:[{url:'/og.png',width:1200,height:630,alt:'Inchframe Studio — A finished film. Not another tool.'}]},twitter:{card:'summary_large_image',title:'INCHFRAME STUDIO',description:'A finished film. Not another tool.',images:['/og.png']}};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
