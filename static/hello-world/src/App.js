import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    invoke('getProjectServices')
      .then(setData)
      .catch(setError);
  }, []);

  if (error) {
    console.error(error);
    return <div><p>Error: {error.message}</p></div>;
  }

  if (!data) {
    return <div><p>Loading...</p></div>;
  }

  if (!data.services || data.services.length === 0) {
    return <div><p>No services found for this project.</p></div>;
  }

  return (
    <div>
      {data.services.map((service, index) => (
        <div key={index}>
          <h3>{service.name}</h3>
          <p>Estimated: {service.estimatedHours}h</p>
          <p>Worked: {service.workedHours}h</p>
          <p>Remaining: {service.remainingHours}h</p>
        </div>
      ))}
    </div>
  );
}

export default App;