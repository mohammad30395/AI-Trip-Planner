# Project Spec

AI Trip Planner is an authenticated trip-planning application.

Users provide:
- Source
- Destination
- Duration
- Budget
- Group size

The app uses a conversational generative UI to collect inputs, clarify missing details, and produce a structured itinerary. Trip output includes day-by-day plans, hotels, activities, and practical place details.

Saved trips are available to authenticated users. Geoapify enriches hotels and activities with provider place IDs, canonical coordinates, formatted addresses, optional images, attribution metadata, and other normalized place metadata.

The map experience uses Mapbox GL JS, with a future 3D route/place visualization. The free tier allows a limited quota of successful trip generations. Paid users receive unlimited trip generation through Clerk Billing entitlement checks.
