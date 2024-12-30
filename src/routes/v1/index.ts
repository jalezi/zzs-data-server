import { uptime } from 'node:process';
import { Router } from 'express';
import { logger } from '../../utils/logger';
import dataRoutes from './dataRoutes';
import doctorRoutes from './doctorRoutes';

const router = Router();

export async function checkGitHubRepoStatus(
  owner: string,
  repo: string,
): Promise<boolean> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        // Add a token if needed for rate-limited requests:
        // 'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      },
    });
    if (response.ok) {
      logger.info(`GitHub repository ${owner}/${repo} is active.`);
      return true;
    }
    if (response.status === 404) {
      logger.warn(`GitHub repository ${owner}/${repo} not found.`);
      return false;
    }
    logger.error(
      `Unexpected status ${response.status} when checking ${owner}/${repo}`,
    );
    return false;
  } catch (error) {
    logger.error(
      { error },
      `Failed to check GitHub repository ${owner}/${repo}`,
    );
    return false;
  }
}

router.get('/healthcheck', async (_req, res) => {
  const isRepoActive = await checkGitHubRepoStatus(
    'sledilnik',
    'zdravniki-data',
  );
  res.status(200).json({
    success: true,
    message: 'API v1 is healthy',
    uptime: uptime(),
    zdravnikiDataRepo: isRepoActive ? 'active' : 'inactive',
  });
});
router.use('/data', dataRoutes);
router.use('/doctors', doctorRoutes);

export default router;
