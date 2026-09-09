with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'r') as f:
    content = f.read()

home_state_insertion = """    const [formData, setFormData] = useState({
        department: '', date: '', time: '', patientName: '', phone: ''
    });
    const [dateType, setDateType] = useState('text');"""

content = content.replace("""    const [formData, setFormData] = useState({
        department: '', date: '', time: '', patientName: '', phone: ''
    });""", home_state_insertion)

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(content)

with open('/Users/jitkarmakar/Desktop/UPLOAD_THESE_TO_GITHUB/Home.jsx', 'w') as f:
    f.write(content)
