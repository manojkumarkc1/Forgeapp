import fetch from "node-fetch";

export async function fetchPublicData() {
  try {
    const res = await fetch("https://jsonplaceholder.typicode.com/users");
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Backend fetch error:", err);
    return [];
  }
}
