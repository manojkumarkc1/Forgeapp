import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getProjectServices', async ({ context }) => {
    const issueKey = context.extension.issue.key;
    const productiveIdCustomField = 'customfield_10289';

    try {
        const jiraIssue = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}?fields=${productiveIdCustomField}`);
        const issueData = await jiraIssue.json();
        const productiveOrganizationId = issueData.fields[productiveIdCustomField];

        if (!productiveOrganizationId) {
            return { services: [{ name: "No Productive ID", estimatedHours: 0, workedHours: 0, remainingHours: 0 }] };
        }

        const productiveApiToken = process.env.PRODUCTIVE_API_TOKEN;

        const projectsApiUrl = `https://api.productive.io/api/v2/projects`;

        const projectsResponse = await api.fetch(
            projectsApiUrl,
            {
                headers: {
                    'X-Auth-Token': '5c588d55-0c08-4cd5-a30d-76c99480af40',
                    'X-Organization-Id': '36880',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const projectsData = await projectsResponse.json();

        // Check if data exists before filtering
        if (!projectsData.data) {
            return { services: [{ name: "Failed to load projects from API", estimatedHours: 0, workedHours: 0, remainingHours: 0 }] };
        }

        const allProjects = projectsData.data;

        // Filter projects in the app's code to find the correct one
        const matchingProjects = allProjects.filter(project => 
            project.attributes.name === 'AUT SharePoint Support'
        );

        if (!matchingProjects.length) {
            return { services: [{ name: "No matching projects found", estimatedHours: 0, workedHours: 0, remainingHours: 0 }] };
        }

        const servicePromises = matchingProjects.map(project => {
            const servicesApiUrl = `https://api.productive.io/api/v2/services?filter[project_id][]=${project.id}&include=projects`;
            return api.fetch(servicesApiUrl, {
                headers: {
                    'X-Auth-Token': productiveApiToken,
                    'X-Organization-Id': productiveOrganizationId,
                    'Content-Type': 'application/json'
                }
            }).then(res => res.json());
        });

        const allServicesData = await Promise.all(servicePromises);
        
        let allServices = [];
        allServicesData.forEach(servicesData => {
            if (servicesData.data && servicesData.data.length > 0) {
                const servicesForProject = servicesData.data.map(service => {
                    const project = servicesData.included ? servicesData.included.find(inc => inc.type === 'projects' && inc.id === service.relationships.project.data.id) : null;
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
            return { services: [{ name: "No services found for projects", estimatedHours: 0, workedHours: 0, remainingHours: 0 }] };
        }

        return { services: allServices };

    } catch (err) {
        console.error(err);
        return { services: [{ name: "Server Error", estimatedHours: 0, workedHours: 0, remainingHours: 0 }] };
    }
});

export const handler = resolver.getDefinitions();