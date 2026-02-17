const DEFAULT_COORDS = { latitude: -17.8, longitude: 31.0 };

export async function fetchDailyWeather(coords = DEFAULT_COORDS) {
  const latitude = Number(coords.latitude ?? DEFAULT_COORDS.latitude);
  const longitude = Number(coords.longitude ?? DEFAULT_COORDS.longitude);
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
  );

  const data = await res.json();

  return data.daily.time.map((date, i) => ({
    date,
    maxTemp: data.daily.temperature_2m_max[i],
    minTemp: data.daily.temperature_2m_min[i],
    rain: data.daily.precipitation_sum[i],
  }));
}
