import {Footer, Layout, Navbar, Link} from 'nextra-theme-docs'
import {Head} from 'nextra/components'
import {getPageMap} from 'nextra/page-map'
import './globals.css'

export const metadata = {
    metadataBase: new URL('https://oid.iks.moe'),
    title: {
        template: '%s | Signaliks OID Repository',
        default: 'Signaliks OID Repository',
    },
    generator: 'Next.js',
    description: 'Repository site for Signaliks affiliated object identifiers.',
    keywords: ['OID', 'Object Identifier', 'PKI', 'Assignment Policy', 'Registration Authority'],
    applicationName: 'iks OID Repo',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        url: './',
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        site: 'https://oid.iks.moe',
    },
    alternates: {
        canonical: './'
    }
}

const navbar = (
    <Navbar
        logo={<><span>Signaliks OID Repository</span></>}
    />
)

const footer =
    <Footer className="py-4"><p className="text-xs">
        © {new Date().getFullYear()} Signaliks. Powered by <Link href="https://nextra.site/" className="text-current hover:underline">Nextra</Link>. <Link href="/privacy-policy" className="text-current hover:underline">Privacy Policy</Link>
    </p></Footer>

export default async function RootLayout({children}) {
    return (
        <html lang="en-US" dir="ltr" suppressHydrationWarning>
        <Head/>
        <body>
        <Layout
            navbar={navbar}
            editLink={null}
            feedback={{ content: null }}
            navigation={{
                prev: false,
                next: false
            }}
            pageMap={await getPageMap()}
            footer={footer}
        >
            {children}
        </Layout>
        </body>
        </html>
    )
}
