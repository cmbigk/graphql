# GraphQL Profile Dashboard

A modern web application that allows users to authenticate and view their profile information and progress data through GraphQL API integration. Built specifically for GritLab students to visualize their learning journey and achievements.

## Features

### 🔐 Authentication
- Secure login using username/email and password
- JWT-based authentication with GritLab API
- Session management with logout functionality

### 📊 Profile Dashboard
- **User Information Display**: Campus, ID, name, email
- **Progress Metrics**: Total XP, audit ratio, completed/received audits
- **Interactive Charts**: 
  - XP per project (bar chart)
  - XP progress over time (line chart)
- **Responsive Design**: Works on desktop and mobile devices

### 🎯 Data Visualization
- SVG-based charts for optimal performance
- Real-time data fetching from GraphQL API
- Color-coded progress indicators
- Cumulative XP tracking over time

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **API**: GraphQL (GritLab API)
- **Authentication**: JWT Bearer tokens
- **Charts**: Custom SVG generation
- **Styling**: Modern CSS with flexbox and grid

## Setup & Installation

### 🌐 Live Demo
**Access the application directly**: [https://cmbigk.github.io/graphql/](https://cmbigk.github.io/graphql/)



1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd graphql-1
   ```

2. **Open the application**:
   - Simply open `index.html` in your web browser
 

 

3. **Access the application**:
   - open `index.html` directly in your browser

## Usage

1. **Login**: Enter your GritLab username/email and password
2. **View Profile**: Access your personal dashboard with:
   - Basic information (campus, name, email)
   - Progress statistics (XP, audit ratio)
   - Visual charts showing your learning progression
3. **Navigate**: Use the logout button to return to the login screen

## API Integration

The application integrates with the GritLab GraphQL API:
- **Authentication Endpoint**: `https://01.gritlab.ax/api/auth/signin`
- **GraphQL Endpoint**: `https://01.gritlab.ax/api/graphql-engine/v1/graphql`

### GraphQL Queries
- User information (profile details)
- XP transactions (filtered to exclude piscine projects)
- Aggregated XP data for progress tracking

## Project Structure

```
graphql-1/
├── index.html          # Main HTML structure
├── main.js            # JavaScript application logic
├── style.css          # Styling and responsive design
└── README.md          # Project documentation
```

## Features in Detail

### Authentication Flow
- Basic authentication with Base64 encoding
- JWT token management
- Error handling for failed logins

### Data Processing
- XP transactions grouped by project
- Progress tracking over time
- Audit ratio calculations
- Filtering of piscine-related projects

### Visual Components
- Dynamic SVG chart generation
- Responsive bar charts for project XP
- Progressive line charts for XP over time
- Grid lines and labels for better readability

## Browser Compatibility

- Modern browsers supporting ES6+ features
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers for responsive viewing

## Security Considerations

- Credentials are not stored locally
- JWT tokens are used for API authentication
- HTTPS endpoints for secure communication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is created for educational purposes as part of the GritLab curriculum.

---

**Note**: This application requires valid GritLab credentials to function properly. Ensure you have access to the GritLab platform before using this dashboard.

