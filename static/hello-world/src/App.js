import { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

export default function ProjectServices() {
  const [services, setServices] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    invoke('getProjectServices')
      .then(res => {
        if (res.error) {
          setError(res.error);
        } else {
          setServices(res.services);
        }
      })
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (!services.length) return <div>Loading...</div>;

  return (
    <div>
      {services.map((s, idx) => (
        <div key={idx}>
          <strong>{s.name}</strong><br>
          </br>
           — Estimated: {s.estimatedHours}h,
           Worked: {s.workedHours}h,
           Remaining: {s.remainingHours}h
        </div>
      ))}
    </div>
  );
}