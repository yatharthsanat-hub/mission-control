export const sourceRegistryRevision = 'phase-0-sources-1'

export const sources = {
  earthGm: {
    id: 'jpl-de440-earth-gm',
    title: 'JPL Astrodynamic Parameters',
    url: 'https://ssd.jpl.nasa.gov/astro_par.html',
    locator: 'Planetary Masses, Earth row',
    revision: 'DE440 (Park et al., 2021)',
    category: 'Direct NASA data',
    attribution: 'NASA/JPL Solar System Dynamics',
  },
  science: {
    id: 'nasa-science-missions-2025',
    title: 'Design and Develop Science Missions',
    url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf',
    locator: 'Slides 8, 13, 18–19',
    revision: 'March 26, 2025',
    category: 'NASA engineering guidance',
    attribution: 'Julie Levri, NASA',
  },
  landsat: {
    id: 'nasa-landsat9-oli-bands',
    title: 'Landsat 9',
    url: 'https://science.nasa.gov/mission/landsat-9/',
    locator: 'Operational Land Imager, bands 4 and 5',
    revision: 'Reference accessed November 14, 2026',
    category: 'Direct NASA data',
    attribution: 'NASA Science, NASA/USGS Landsat program',
  },
} as const
