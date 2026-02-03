export const samplePlants = [
  {
    id: "demo-1",
    plantName: "Demo Rice",
    farmLocation: "Kampong Cham",
    plantedDate: "2025-01-15",
    harvestDate: "2025-06-30",
    status: "well_planted",
  },
];

export const sampleSensorSnapshot = {
  temperature: { value: 28, unit: "°C", time: new Date().toISOString() },
  moisture: { value: 55, unit: "%", time: new Date().toISOString() },
};
