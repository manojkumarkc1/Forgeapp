import Resolver from '@forge/resolver';
import api from '@forge/api';

const resolver = new Resolver();



resolver.define('getProjectServices', async () => {
  try {
    const res = await api.fetch(
  `https://api.productive.io/api/v2/services?filter[project_id][]=640568`,
  {
    headers: {
      'X-Auth-Token': '5c588d55-0c08-4cd5-a30d-76c99480af40',
      'X-Organization-Id':'36880',
      'Content-Type': 'application/json'
    }
  }
);
    if (!res.ok) {
      return { error: `Failed to fetch services: ${res.status}` };
    }

    const data = await res.json();

    // Map services to simple object
    const services = data.data.map(service => ({
      name: service.attributes.name,
      estimatedHours: service.attributes.estimated_time / 60,
      workedHours: service.attributes.worked_time / 60,
      remainingHours: (service.attributes.estimated_time - service.attributes.worked_time)

    }));

    return { services };

  } catch (err) {
    console.error(err);
    return { error: 'Server error' };
  }
});

export const handler = resolver.getDefinitions();

