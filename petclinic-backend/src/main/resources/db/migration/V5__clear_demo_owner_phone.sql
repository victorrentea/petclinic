-- The MCP demo owner (sub=1 in the demo JWT -> owner id=1 = Kevin McCallister) starts WITHOUT a
-- phone number, so the chatbot's create_visit tool ELICITS one on the first booking and only asks
-- to CONFIRM it on later bookings. Done as a new migration (never edit an applied one).
UPDATE owners SET telephone = NULL WHERE first_name = 'Kevin' AND last_name = 'McCallister';
