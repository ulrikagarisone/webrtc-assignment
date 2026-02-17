# WebRTC Assignment: The Ouija Experience 

## Project Overview Idea
This project is a one-to-one interactive experience where a smartphone (mobile) acts as a planchette to control a desktop Ouija board. It utilizes WebSockets for signaling and WebRTC Data Channels for real-time sensor-based control.

## Development Diary

### Feb 17, 2026: Project Initialization
* **Setup**: Created the repository.
* **Architecture**: Established a Node.js server with Express and Socket.io. 
* **Structure**: Organized the `/public` directory with dedicated files for `desktop` (receiver) and `mobile` (controller).
* **Installed** qrcode library to handle the one-to-one connection requirement. Verified that package.json includes all necessary dependencies for a clean npm install by the instructors.
* **AI Reflection**: 
    * **Use**: Consulted AI to help me with the "Ouija Board" concept to maximize bonus points for sensors and video.
    * **Modifications**: AI suggested a complex 3D setup, but I refactored the plan to a 2D approach to stay within my current technical comfort level and ensure stability.
    * **Git**: Used AI to troubleshoot a `refs/heads/main` error during the first push.