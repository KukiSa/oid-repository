import nextra from 'nextra'

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
    output: 'export',
    images: {
        unoptimized: true
    }
}
const withNextra = nextra({
})

// Export the final Next.js config with Nextra included
export default withNextra({
    turbopack: {
        resolveAlias: {
            'next-mdx-import-source-file': './mdx-components.jsx'
        }
    }
})
