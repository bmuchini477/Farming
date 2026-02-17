export function generateWeatherAlerts(weather, crops) {
  const alerts = [];

  crops.forEach((crop) => {
    const stage = crop.stage;

    weather.slice(0, 3).forEach((day) => {
      // Heavy rain
      if (day.rain > 20 && ["Flowering", "Maturity"].includes(stage)) {
        alerts.push({
          type: "rain",
          level: "danger",
          message: `Heavy rain (${day.rain}mm) expected on ${day.date} during ${stage} stage for ${crop.name}.`,
        });
      }

      // Moderate rain
      if (day.rain >= 10 && day.rain <= 20 && stage === "Maturity") {
        alerts.push({
          type: "rain",
          level: "warning",
          message: `Moderate rain (${day.rain}mm) may affect harvest of ${crop.name}.`,
        });
      }

      // Heat stress
      if (day.maxTemp > 35 && ["Vegetative", "Flowering"].includes(stage)) {
        alerts.push({
          type: "heat",
          level: "danger",
          message: `High temperature (${day.maxTemp}°C) may stress ${crop.name} during ${stage}.`,
        });
      }

      // Cold risk
      if (day.minTemp < 10 && stage === "Seedling") {
        alerts.push({
          type: "cold",
          level: "warning",
          message: `Low temperature (${day.minTemp}°C) may harm seedlings of ${crop.name}.`,
        });
      }
    });
  });

  return alerts;
}
