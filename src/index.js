  import Resolver from '@forge/resolver';
  import api, { route } from '@forge/api';

  const resolver = new Resolver();

  resolver.define('getProjectServices', async ({ context }) => {
    console.log("Context object:", JSON.stringify(context, null, 2));

    try {
      const issueKey = context.extension.issue.key;
      const cloudId = context.cloudId;

      // --- Step 1: Jira Issue ---
      const issueResponse = await api.asApp().requestJira(
        route`/rest/api/3/issue/${issueKey}?fields=customfield_10002`
      );
      const issueText = await issueResponse.text();
      console.log("Jira issue raw response:", issueText);

      if (!issueResponse.ok) {
        return {
          services: [{
            name: `Failed Jira issue API call: ${issueResponse.status} - ${issueText}`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      let issueData;
      try {
        issueData = JSON.parse(issueText);
      } catch (e) {
        return {
          services: [{
            name: `Invalid JSON from Jira issue API: ${issueText}`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      const organizations = issueData?.fields?.customfield_10002;
      console.log("Organizations variable:", organizations);

      if (!organizations || organizations.length === 0) {
        return {
          services: [{
            name: "No JSM Organization linked to this ticket.",
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      const organizationId = organizations[0].id;

      // --- Step 2: JSM Org Details ---
      const jiraOrg = await api.fetch(
  `https://api.atlassian.com/jsm/csm/cloudid/${cloudId}/api/v1/organization/${organizationId}`,
  {
    headers: {
      'Accept': 'application/json',
      'Authorizattion': 'Bearer '
    }
  }
);
      const jiraOrgText = await jiraOrg.text();
      console.log("JSM Org raw response:", jiraOrgText);

      if (!jiraOrg.ok) {
        return {
          services: [{
            name: `Failed JSM Org API call: ${jiraOrg.status} - ${jiraOrgText}`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      let orgData;
      try {
        orgData = JSON.parse(jiraOrgText);
      } catch (e) {
        return {
          services: [{
            name: `Invalid JSON from JSM Org API: ${jiraOrgText}`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      const productiveDetail = orgData.details.find(d => d.name === 'ProductiveID');
      const productiveCompanyId = productiveDetail?.values?.[0];
      if (!productiveCompanyId) {
        return {
          services: [{
            name: "Missing 'ProductiveID' on JSM Organization.",
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      // --- Step 3: Productive Projects ---
      const projectsApiUrl = `https://api.productive.io/api/v2/projects?filter[company_id]=${productiveCompanyId}`;
      const projectsResponse = await api.fetch(projectsApiUrl, {
        headers: {
          'X-Auth-Token': '5c588d55-0c08-4cd5-a30d-76c99480af40',
          'X-Organization-Id': '36880',
          'Content-Type': 'application/json'
        }
      });
      const projectsText = await projectsResponse.text();
      console.log("Projects raw response:", projectsText);

      if (!projectsResponse.ok) {
        return {
          services: [{
            name: `Failed Productive projects API: ${projectsResponse.status} - ${projectsText}`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      let projectsData;
      try {
        projectsData = JSON.parse(projectsText);
      } catch (e) {
        return {
          services: [{
            name: `Invalid JSON from Productive projects API: ${projectsText}`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      const allProjects = projectsData.data || [];
      const targetProjectName = "AUT SharePoint Support";
      const matchingProjects = allProjects.filter(p => p.attributes.name === targetProjectName);

      if (!matchingProjects.length) {
        return {
          services: [{
            name: `No project found with the name "${targetProjectName}".`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      // --- Step 4: Productive Services ---
      const servicePromises = matchingProjects.map(project => {
        const servicesApiUrl = `https://api.productive.io/api/v2/services?filter[project_id][]=${project.id}&include=projects`;
        return api.fetch(servicesApiUrl, {
          headers: {
            'X-Auth-Token': '5c588d55-0c08-4cd5-a30d-76c99480af40',
            'X-Organization-Id': '36880',
            'Content-Type': 'application/json'
          }
        }).then(async res => {
          const text = await res.text();
          console.log(`Services raw response for project ${project.id}:`, text);

          if (!res.ok) return { error: `Service API failed: ${res.status} - ${text}` };

          try {
            return JSON.parse(text);
          } catch {
            return { error: `Invalid JSON from Services API: ${text}` };
          }
        });
      });

      const allServicesData = await Promise.all(servicePromises);

      let allServices = [];
      allServicesData.forEach(servicesData => {
        if (servicesData.error) {
          allServices.push({
            name: servicesData.error,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          });
          return;
        }

        if (servicesData.data && servicesData.data.length > 0) {
          const servicesForProject = servicesData.data.map(service => {
            const project = servicesData.included
              ? servicesData.included.find(inc => inc.type === 'projects' && inc.id === service.relationships.project.data.id)
              : null;
            const projectName = project ? project.attributes.name : 'Unknown Project';

            return {
              name: `${service.attributes.name} (${projectName})`,
              estimatedHours: service.attributes.estimated_time / 60,
              workedHours: service.attributes.worked_time / 60,
              remainingHours: (service.attributes.estimated_time - service.attributes.worked_time) / 60
            };
          });
          allServices = allServices.concat(servicesForProject);
        }
      });

      if (allServices.length === 0) {
        return {
          services: [{
            name: `No services found for project "${targetProjectName}".`,
            estimatedHours: 0, workedHours: 0, remainingHours: 0
          }]
        };
      }

      return { services: allServices };

    } catch (err) {
      console.error("Unexpected error:", err);
      return {
        services: [{
          name: "Server Error",
          estimatedHours: 0, workedHours: 0, remainingHours: 0
        }]
      };
    }
  });

  export const handler = resolver.getDefinitions();