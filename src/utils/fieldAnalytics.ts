export type NumericRange = {
  min: number;
  max: number;
};

export type SoilData = {
  organicMatter?: number;
  electricalConductivity?: number;
  soilTemperature?: number;
  soilMoisture?: number;
};

export type WeatherData = {
  temperatureC?: number;
  rainfallMm?: number;
  humidityPct?: number;
  evapotranspirationMm?: number;
};

export type CropIdealConditions = {
  temperature?: NumericRange;
  rainfall?: NumericRange;
  humidity?: NumericRange;
};

export type GrowthData = {
  ndviIndex?: number;
  leafColorIndex?: number;
  plantPopulationPerSqm?: number;
  daysAfterPlanting?: number;
};

export type CropProfile = {
  targetNdvi?: number;
  targetLeafColor?: number;
  targetPopulationPerSqm?: number;
};

export type IrrigationData = {
  soilMoistureBefore?: number;
  soilMoistureAfter?: number;
  waterAmountMm?: number;
};

export type PestReport = {
  affectedAreaPercentage?: number;
  severityLevel?: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreFromRange(value: number | undefined, range: NumericRange | undefined): number {
  if (!Number.isFinite(value) || !range) return 50;
  if (value >= range.min && value <= range.max) return 100;

  const distance = value < range.min ? range.min - value : value - range.max;
  const span = Math.max(1, range.max - range.min);
  return clampScore(100 - (distance / span) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeSoilHealth(soilData: SoilData): number {
  const organicMatterScore = clampScore(((soilData.organicMatter ?? 0) / 6) * 100);
  const conductivityPenalty = clampScore(100 - Math.max(0, (soilData.electricalConductivity ?? 0) - 1.5) * 20);
  const temperatureScore = clampScore(100 - Math.abs((soilData.soilTemperature ?? 25) - 25) * 5);
  const moistureScore = clampScore(100 - Math.abs((soilData.soilMoisture ?? 35) - 35) * 3);
  return clampScore(average([organicMatterScore, conductivityPenalty, temperatureScore, moistureScore]));
}

export function computeWeatherSuitability(weatherData: WeatherData, cropIdealConditions: CropIdealConditions): number {
  const tempScore = scoreFromRange(weatherData.temperatureC, cropIdealConditions.temperature);
  const rainScore = scoreFromRange(weatherData.rainfallMm, cropIdealConditions.rainfall);
  const humidityScore = scoreFromRange(weatherData.humidityPct, cropIdealConditions.humidity);
  return clampScore(average([tempScore, rainScore, humidityScore]));
}

export function computeGrowthDeviation(growthData: GrowthData, cropProfile: CropProfile): number {
  const ndviDelta = Math.abs((growthData.ndviIndex ?? 0) - (cropProfile.targetNdvi ?? 0.75));
  const leafColorDelta = Math.abs((growthData.leafColorIndex ?? 0) - (cropProfile.targetLeafColor ?? 45));
  const populationDelta = Math.abs((growthData.plantPopulationPerSqm ?? 0) - (cropProfile.targetPopulationPerSqm ?? 8));

  const ndviScore = clampScore(100 - ndviDelta * 200);
  const leafScore = clampScore(100 - leafColorDelta * 2);
  const populationScore = clampScore(100 - populationDelta * 12);

  return clampScore(average([ndviScore, leafScore, populationScore]));
}

export function computeWaterStress(weatherData: WeatherData, irrigationData: IrrigationData): number {
  const evap = weatherData.evapotranspirationMm ?? 4;
  const waterApplied = irrigationData.waterAmountMm ?? 0;
  const moistureLift = (irrigationData.soilMoistureAfter ?? 0) - (irrigationData.soilMoistureBefore ?? 0);

  const replenishmentScore = clampScore(50 + (waterApplied - evap) * 10);
  const moistureRecoveryScore = clampScore(50 + moistureLift * 5);

  return clampScore(average([replenishmentScore, moistureRecoveryScore]));
}

export function computePestImpact(pestReports: PestReport[]): number {
  if (!pestReports.length) return 100;

  const impactScores = pestReports.map((report) => {
    const area = report.affectedAreaPercentage ?? 0;
    const severity = report.severityLevel ?? 1;
    const penalty = area * 0.7 + severity * 10;
    return clampScore(100 - penalty);
  });

  return clampScore(average(impactScores));
}

export function computeFieldHealthIndex(allScores: number[]): number {
  const normalized = allScores.filter((score) => Number.isFinite(score)).map((score) => clampScore(score));
  if (!normalized.length) return 0;
  return clampScore(average(normalized));
}
