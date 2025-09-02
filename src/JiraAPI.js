import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getProjectServices', async ({ context }) => {
  const issueKey = context.extension.issue.key;
  const productiveIdCustomField = '110';

  try {
    const jiraIssue = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}?fields=${productiveIdCustomField}`);
    const issueData = await jiraIssue.json();

    const productiveCompanyId = issueData.fields[productiveIdCustomField];

    return { message: `Productive ID: ${productiveCompanyId}` };

  } catch (err) {
    return { message: `Error: Could not retrieve Productive ID. ${err.message}` };
  }
});

export const handler = resolver.getDefinitions();