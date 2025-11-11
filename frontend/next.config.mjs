<<<<<<< HEAD
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  devIndicators: false,

  output: 'standalone',

<<<<<<< HEAD:next.config.mjs
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  },
};

export default nextConfig;


// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
//   devIndicators: false,

// }

// export default nextConfig;  
=======
module.exports = nextConfig
>>>>>>> parent of f16c18a (Corrigindo next.config.mjs para export default):frontend/next.config.mjs
=======
// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   /* config options here */
//   devIndicators: false,

//   output: 'standalone',

//   pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],

//   env: {
//     NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
//   },
// };

// export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: 'standalone'

}

module.exports = nextConfig
>>>>>>> parent of f16c18a (Corrigindo next.config.mjs para export default)
