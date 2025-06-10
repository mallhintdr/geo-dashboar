// userUtils.js
export const subscriptionOptions = [
  { value: 'Trial', days: 5 },
  { value: 'Monthly', days: 30 },
  { value: 'Quarterly', days: 90 },
  { value: 'Biannual', days: 180 },
  { value: 'Annual', days: 1000},
];

export const calculateEndDate = (startDate, subscriptionType) => {
  if (!startDate || isNaN(new Date(startDate).getTime())) {
    console.error("Invalid startDate provided:", startDate);
    return null;
  }

  const option = subscriptionOptions.find(opt => opt.value === subscriptionType);
  const days = option ? option.days : 0;
  const start = new Date(startDate);

  // Set the end date as a Date object
  const endDate = new Date(start);
  endDate.setDate(start.getDate() + days);
  return endDate; // Returns a Date object
};

export const calculateDaysRemaining = (startDate, subscriptionType) => {
  const endDate = calculateEndDate(startDate, subscriptionType);
  if (!endDate) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)), 0);
};

export const calculateStatus = (endDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return endDate && new Date(endDate) >= today ? 'Active' : 'Inactive';
};

export const getCurrentDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};
