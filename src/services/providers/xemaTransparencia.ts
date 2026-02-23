function fetch30minObservations() {
    // Assuming bounds is defined somewhere in the scope
    const startDate = bounds.fromDateTime;
    const endDate = bounds.toExclusiveDateTime;

    // Fetch logic here...
    const observations = fetchData({
        // ... other parameters
        dateRange: {
            from: startDate,
            to: endDate,
        },
        // Adjusting query to use < operator instead of <=
    });

    return observations;
}