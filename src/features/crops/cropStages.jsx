export const defaultStages = [
  { name: "Germination", fromDay: 0, toDay: 7, tips: ["Keep soil moist"] },
  { name: "Seedling", fromDay: 8, toDay: 21, tips: ["Weeding", "Early pest control"] },
  { name: "Vegetative", fromDay: 22, toDay: 60, tips: ["Top dressing", "Monitor growth"] },
  { name: "Flowering", fromDay: 61, toDay: 90, tips: ["Avoid water stress"] },
  { name: "Maturity", fromDay: 91, toDay: 120, tips: ["Prepare for harvest"] },
];

export function stageForDay(day) {
  return (
    defaultStages.find((s) => day >= s.fromDay && day <= s.toDay) ||
    defaultStages[defaultStages.length - 1]
  );
}
