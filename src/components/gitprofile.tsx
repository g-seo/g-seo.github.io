import { useCallback, useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { formatDistance } from 'date-fns';
import {
  CustomError,
  GENERIC_ERROR,
  INVALID_CONFIG_ERROR,
  INVALID_GITHUB_USERNAME_ERROR,
  setTooManyRequestError,
} from '../constants/errors';
import '../assets/index.css';
import { getInitialTheme, getSanitizedConfig, setupHotjar } from '../utils';
import { SanitizedConfig } from '../interfaces/sanitized-config';
import ErrorPage from './error-page';
import { DEFAULT_THEMES } from '../constants/default-themes';
import { BG_COLOR } from '../constants';
import AvatarCard from './avatar-card';
import { Profile } from '../interfaces/profile';
import DetailsCard from './details-card';
import SkillCard from './skill-card';
import ExperienceCard from './experience-card';
import EducationCard from './education-card';
import CertificationCard from './certification-card';
import { GithubProject } from '../interfaces/github-project';
import GithubProjectCard from './github-project-card';
import ExternalProjectCard from './external-project-card';
import BlogCard from './blog-card';
import Footer from './footer';
import PublicationCard from './publication-card';

/**
 * Renders the GitProfile component.
 *
 * @param {Object} config - the configuration object
 * @return {JSX.Element} the rendered GitProfile component
 */
const GitProfile = ({ config }: { config: Config }) => {
  const [sanitizedConfig] = useState<SanitizedConfig | Record<string, never>>(
    getSanitizedConfig(config),
  );
  const [theme, setTheme] = useState<string>(DEFAULT_THEMES[0]);
  const [error, setError] = useState<CustomError | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [githubProjects, setGithubProjects] = useState<GithubProject[]>([]);

  const getGithubProjects = useCallback(
    async (publicRepoCount: number): Promise<GithubProject[]> => {
      if (sanitizedConfig.projects.github.mode === 'automatic') {
        if (publicRepoCount === 0) {
          return [];
        }

        const excludeRepo =
          sanitizedConfig.projects.github.automatic.exclude.projects
            .map((project) => `+-repo:${project}`)
            .join('');

        const query = `user:${sanitizedConfig.github.username}+fork:${!sanitizedConfig.projects.github.automatic.exclude.forks}${excludeRepo}`;
        const url = `https://api.github.com/search/repositories?q=${query}&sort=${sanitizedConfig.projects.github.automatic.sortBy}&per_page=${sanitizedConfig.projects.github.automatic.limit}&type=Repositories`;

        const repoResponse = await axios.get(url, {
          headers: { 'Content-Type': 'application/vnd.github.v3+json' },
        });
        const repoData = repoResponse.data;

        return repoData.items;
      } else {
        if (sanitizedConfig.projects.github.manual.projects.length === 0) {
          return [];
        }
        const repos = sanitizedConfig.projects.github.manual.projects
          .map((project) => `+repo:${project}`)
          .join('');

        const url = `https://api.github.com/search/repositories?q=${repos}+fork:true&type=Repositories`;

        const repoResponse = await axios.get(url, {
          headers: { 'Content-Type': 'application/vnd.github.v3+json' },
        });
        const repoData = repoResponse.data;

        return repoData.items;
      }
    },
    [
      sanitizedConfig.github.username,
      sanitizedConfig.projects.github.mode,
      sanitizedConfig.projects.github.manual.projects,
      sanitizedConfig.projects.github.automatic.sortBy,
      sanitizedConfig.projects.github.automatic.limit,
      sanitizedConfig.projects.github.automatic.exclude.forks,
      sanitizedConfig.projects.github.automatic.exclude.projects,
    ],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `https://api.github.com/users/${sanitizedConfig.github.username}`,
      );
      const data = response.data;

      setProfile({
        avatar: data.avatar_url,
        name: data.name || ' ',
        bio: data.bio || '',
        location: data.location || '',
        company: data.company || '',
      });

      if (!sanitizedConfig.projects.github.display) {
        return;
      }

      setGithubProjects(await getGithubProjects(data.public_repos));
    } catch (error) {
      handleError(error as AxiosError | Error);
    } finally {
      setLoading(false);
    }
  }, [
    sanitizedConfig.github.username,
    sanitizedConfig.projects.github.display,
    getGithubProjects,
  ]);

  useEffect(() => {
    if (Object.keys(sanitizedConfig).length === 0) {
      setError(INVALID_CONFIG_ERROR);
    } else {
      setError(null);
      setTheme(getInitialTheme(sanitizedConfig.themeConfig));
      setupHotjar(sanitizedConfig.hotjar);
      loadData();
    }
  }, [sanitizedConfig, loadData]);

  useEffect(() => {
    theme && document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleError = (error: AxiosError | Error): void => {
    console.error('Error:', error);

    if (error instanceof AxiosError) {
      try {
        const reset = formatDistance(
          new Date(error.response?.headers?.['x-ratelimit-reset'] * 1000),
          new Date(),
          { addSuffix: true },
        );

        if (typeof error.response?.status === 'number') {
          switch (error.response.status) {
            case 403:
              setError(setTooManyRequestError(reset));
              break;
            case 404:
              setError(INVALID_GITHUB_USERNAME_ERROR);
              break;
            default:
              setError(GENERIC_ERROR);
              break;
          }
        } else {
          setError(GENERIC_ERROR);
        }
      } catch (innerError) {
        setError(GENERIC_ERROR);
      }
    } else {
      setError(GENERIC_ERROR);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5ecd7' }}>
      {error ? (
        <ErrorPage
          status={error.status}
          title={error.title}
          subTitle={error.subTitle}
        />
      ) : (
        <>
          <div style={{ padding: '40px 0', minHeight: '100vh', background: '#f5ecd7' }}>
            {/* 4개 요소를 한 줄에 옆으로 배치 */}
            <div style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '24px',
              borderRadius: '16px',
              justifyContent: 'center'
            }}>
              <div style={{
                background: '#fff8e1',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                flex: 1,
                padding: '24px'
              }}>
                <AvatarCard
                  profile={profile}
                  loading={loading}
                  avatarRing={sanitizedConfig.themeConfig?.displayAvatarRing}
                  resumeFileUrl={sanitizedConfig.resume?.fileUrl}
                />
              </div>
              <div style={{
                background: '#fff8e1',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                flex: 1,
                padding: '24px'
              }}>
                <DetailsCard
                  profile={profile}
                  loading={loading}
                  github={sanitizedConfig.github}
                  social={sanitizedConfig.social}
                />
              </div>
              <div style={{
                background: '#fff8e1',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                flex: 1,
                padding: '24px'
              }}>
                <SkillCard
                  loading={loading}
                  skills={sanitizedConfig.skills}
                />
              </div>
              <div style={{
                background: '#fff8e1',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                flex: 1,
                padding: '24px'
              }}>
                <EducationCard
                  loading={loading}
                  educations={sanitizedConfig.educations}
                />
              </div>
            </div>
            {/* GithubProjectCard를 4개 요소 밑에 전체 너비로 배치 */}
            {sanitizedConfig.projects.github.display && (
              <div style={{
                background: '#fff8e1',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                marginBottom: '24px',
                padding: '24px'
              }}>
                <GithubProjectCard
                  header={sanitizedConfig.projects.github.header}
                  limit={sanitizedConfig.projects.github.automatic.limit}
                  githubProjects={githubProjects}
                  loading={loading}
                  googleAnalyticsId={sanitizedConfig.googleAnalytics.id}
                />
              </div>
            )}
          </div>
          {sanitizedConfig.footer && (
            <footer
              style={{
                padding: '16px',
                background: '#f5ecd7',
                textAlign: 'center'
              }}
            >
              <div style={{
                background: '#fff8e1',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'inline-block',
                padding: '12px 24px'
              }}>
                <Footer content={sanitizedConfig.footer} loading={loading} />
              </div>
            </footer>
          )}
        </>
      )}
    </div>
  );
};

export default GitProfile;
