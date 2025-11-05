import React, { useState, useEffect } from 'react';
import { Mountain, User, FileText, Users, RotateCcw, Download, Plus, X, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

const VisualAssessmentApp = () => {
  const [activeTab, setActiveTab] = useState('challenging');
  const [studentInitials, setStudentInitials] = useState('');
  const [challengingSubject, setChallengingSubject] = useState('');
  const [comfortableSubject, setComfortableSubject] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [pdfLibrariesLoaded, setPdfLibrariesLoaded] = useState(false);
  
  const predefinedCards = [
    'Keeping up with the pace of visual information',
    'Joining in with class discussions', 
    'Reading from the Interactive whiteboard',
    'Working with a partner',
    'Asking for help with work',
    'Using worksheets/books/resources',
    'Explaining visual needs/requirements',
    'Filtering out distractions i.e. sounds',
    'Listening to instructions and watching at the same time',
    'Navigating between classroom spaces',
    'Reading handwritten notes or feedback',
    'Participating in group activities',
    'Managing time during assessments',
    'Using digital learning platforms',
    'Following demonstrations or experiments',
    'Joining in with fast-moving activities (PE/ball games)'
  ];

  const [customCard, setCustomCard] = useState('');
  const [challengingCards, setChallengingCards] = useState({});
  const [comfortableCards, setComfortableCards] = useState({});
  const [planningCards, setPlanningCards] = useState([]);
  const [cardSolutions, setCardSolutions] = useState({});
  const [flippedCards, setFlippedCards] = useState({});
  const [showSuggestions, setShowSuggestions] = useState({});

  // Load PDF libraries from CDN
  useEffect(() => {
    let html2canvasLoaded = false;
    let jsPDFLoadStatus = false;

    // Load html2canvas
    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    html2canvasScript.async = true;
    html2canvasScript.onload = () => {
      console.log('✅ html2canvas loaded');
      html2canvasLoaded = true;
      checkBothLoaded();
    };
    html2canvasScript.onerror = () => console.error('❌ Failed to load html2canvas');
    document.body.appendChild(html2canvasScript);

    // Load jsPDF from unpkg (more reliable than cdnjs)
    const jsPDFScript = document.createElement('script');
    jsPDFScript.src = 'https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js';
    jsPDFScript.async = true;
    jsPDFScript.onload = () => {
      console.log('✅ jsPDF script loaded');
      
      // Check all three possible locations where jsPDF might be exposed
      if (window.jspdf?.jsPDF) {
        console.log('✅ jsPDF found at window.jspdf.jsPDF');
        window.jsPDF = window.jspdf.jsPDF; // Make it available at standard location
        jsPDFLoadStatus = true;
      } else if (window.jsPDF) {
        console.log('✅ jsPDF found at window.jsPDF');
        jsPDFLoadStatus = true;
      } else if (typeof jsPDF !== 'undefined') {
        console.log('✅ jsPDF found in global scope');
        window.jsPDF = jsPDF;
        jsPDFLoadStatus = true;
      } else {
        console.error('❌ jsPDF loaded but not found in any expected location');
        console.log('window.jspdf:', typeof window.jspdf);
        console.log('window.jsPDF:', typeof window.jsPDF);
        console.log('global jsPDF:', typeof jsPDF);
      }
      checkBothLoaded();
    };
    jsPDFScript.onerror = () => console.error('❌ Failed to load jsPDF');
    document.body.appendChild(jsPDFScript);

    function checkBothLoaded() {
      if (html2canvasLoaded && jsPDFLoadStatus) {
        console.log('✅ Both PDF libraries loaded successfully');
        setPdfLibrariesLoaded(true);
      }
    }

    return () => {
      try {
        document.body.removeChild(html2canvasScript);
        document.body.removeChild(jsPDFScript);
      } catch (e) {
        // Scripts might already be removed
      }
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getSuggestedSolutions = (cardText) => {
    const suggestions = {
      'Reading from the Interactive whiteboard': [
        'Sit closer to the front of the classroom',
        'Use a monocular or magnifier',
        'Ask teacher to use larger font and high contrast colors',
        'Request printed copies of board content'
      ],
      'Joining in with class discussions': [
        'Raise hand early to get noticed',
        'Write thoughts down first',
        'Ask for thinking time before responding',
        'Use a visual signal to indicate wanting to speak'
      ],
      'Working with a partner': [
        'Choose partners who understand my visual needs',
        'Explain my visual needs at the start',
        'Use verbal descriptions more',
        'Position ourselves where lighting is best'
      ],
      'Using worksheets/books/resources': [
        'Use a reading ruler or line guide',
        'Enlarge worksheets on photocopier or digitally',
        'Use colored paper instead of white to reduce glare',
        'Request digital versions for screen reading'
      ],
      'Keeping up with the pace of visual information': [
        'Ask teacher to slow down presentations',
        'Record lessons to review later',
        'Use a buddy to share notes',
        'Request breaks during visually intensive tasks'
      ],
      'Listening to instructions and watching at the same time': [
        'Ask for instructions to be repeated',
        'Focus on listening first, then looking',
        'Request written backup of verbal instructions',
        'Use voice recording for complex instructions'
      ],
      'Filtering out distractions i.e. sounds': [
        'Use noise-cancelling headphones',
        'Sit away from noisy areas like doors or windows',
        'Use ear defenders during tests',
        'Request a quiet space for focused work'
      ],
      'Asking for help with work': [
        'Use a help signal card on desk',
        'Practice what to say beforehand',
        'Ask for help early, not when stuck',
        'Establish a signal with teacher for discrete help'
      ],
      'Explaining visual needs/requirements': [
        'Prepare a simple explanation card',
        'Show examples of what helps',
        'Use analogies others can understand',
        'Create a one-page profile of needs'
      ],
      'Navigating between classroom spaces': [
        'Walk with a buddy during transitions',
        'Use consistent, familiar routes',
        'Allow extra time for movement',
        'Use high-contrast markers on key landmarks'
      ],
      'Reading handwritten notes or feedback': [
        'Request typed feedback',
        'Use a document camera to enlarge',
        'Ask teacher to read feedback aloud',
        'Request feedback in consistent, clear font'
      ],
      'Participating in group activities': [
        'Assign specific roles that suit strengths',
        'Use clear verbal communication',
        'Position myself where I can see everyone',
        'Use written notes to track group decisions'
      ],
      'Managing time during assessments': [
        'Request extra time allowance',
        'Use a timer with visual/audio alerts',
        'Practice with timed activities',
        'Break assessment into smaller chunks'
      ],
      'Using digital learning platforms': [
        'Adjust screen brightness and contrast',
        'Use text-to-speech features',
        'Increase font size in settings',
        'Use browser extensions for accessibility'
      ],
      'Following demonstrations or experiments': [
        'Stand closer to demonstrations',
        'Request step-by-step verbal explanations',
        'Review video recordings afterward',
        'Have materials described before handling them'
      ],
      'Joining in with fast-moving activities (PE/ball games)': [
        'Use brightly colored balls with ribbons attached for tracking',
        'Ask for auditory countdown before ball is thrown',
        'Use balls with bells or sound inside',
        'Practice with stationary ball first, then slow-moving',
        'Use high-contrast colored bibs to identify team members',
        'Position in areas with less visual complexity'
      ]
    };
    return suggestions[cardText] || [
      'Break the task into smaller steps',
      'Ask for extra time',
      'Use different lighting',
      'Request alternative formats'
    ];
  };

  const getCurrentCards = () => {
    return activeTab === 'challenging' ? challengingCards : 
           activeTab === 'comfortable' ? comfortableCards : {};
  };

  const setCurrentCards = (cards) => {
    if (activeTab === 'challenging') {
      setChallengingCards(cards);
    } else if (activeTab === 'comfortable') {
      setComfortableCards(cards);
    }
  };

  const handleDragStart = (e, cardText, isCustom = false) => {
    e.dataTransfer.setData('text/plain', cardText);
    e.dataTransfer.setData('isCustom', isCustom.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, difficulty) => {
    e.preventDefault();
    let cardText, isCustom;
    
    if (e.dataTransfer) {
      cardText = e.dataTransfer.getData('text/plain');
      isCustom = e.dataTransfer.getData('isCustom') === 'true';
    } else {
      if (!selectedCard) return;
      cardText = selectedCard.text;
      isCustom = selectedCard.isCustom;
    }
    
    if (!cardText) return;

    const currentCards = getCurrentCards();
    const newCards = { ...currentCards };
    
    Object.keys(newCards).forEach(level => {
      newCards[level] = newCards[level].filter(card => card !== cardText);
      if (newCards[level].length === 0) delete newCards[level];
    });
    
    if (!newCards[difficulty]) newCards[difficulty] = [];
    newCards[difficulty].push(cardText);
    
    setCurrentCards(newCards);

    if (isCustom) {
      setCustomCard('');
    }
    
    setSelectedCard(null);
    setShowCardSelector(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleMobileCardSelect = (cardText, isCustom = false) => {
    setSelectedCard({ text: cardText, isCustom });
    setShowCardSelector(true);
  };

  const handleMobileCardPlace = (difficulty) => {
    if (selectedCard) {
      handleDrop({preventDefault: () => {}}, difficulty);
    }
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      1: 'bg-emerald-100 border-emerald-400',
      2: 'bg-green-100 border-green-400', 
      3: 'bg-amber-100 border-amber-400',
      4: 'bg-orange-100 border-orange-400',
      5: 'bg-red-100 border-red-400'
    };
    return colors[difficulty] || 'bg-gray-100 border-gray-300';
  };

  const toggleCardFlip = (cardText) => {
    const key = `${activeTab}-${cardText}`;
    setFlippedCards(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const updateCardSolution = (cardText, solution) => {
    const key = `${activeTab}-${cardText}`;
    setCardSolutions(prev => ({
      ...prev,
      [key]: solution
    }));
  };

  const getCardSolution = (cardText) => {
    const key = `${activeTab}-${cardText}`;
    return cardSolutions[key] || '';
  };

  const isCardFlipped = (cardText) => {
    const key = `${activeTab}-${cardText}`;
    return flippedCards[key] || false;
  };

  const getAvailableCards = () => {
    const currentCards = getCurrentCards();
    const usedCards = Object.values(currentCards).flat();
    return predefinedCards.filter(card => !usedCards.includes(card));
  };

  const moveToPlanning = (cardText) => {
    const solutionKey = `${activeTab}-${cardText}`;
    const solution = cardSolutions[solutionKey] || '';
    
    if (!planningCards.find(item => item.card === cardText)) {
      const newPlanningCard = {
        card: cardText,
        solution: solution,
        who: '',
        what: solution,
        when: ''
      };
      
      setPlanningCards(prev => [...prev, newPlanningCard]);
    }
    setActiveTab('planning');
  };

  const updatePlanningCard = (index, field, value) => {
    setPlanningCards(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removePlanningCard = (index) => {
    setPlanningCards(prev => prev.filter((_, i) => i !== index));
  };

  const resetAllData = () => {
    if (window.confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      setStudentInitials('');
      setChallengingSubject('');
      setComfortableSubject('');
      setChallengingCards({});
      setComfortableCards({});
      setPlanningCards([]);
      setCardSolutions({});
      setFlippedCards({});
      setShowSuggestions({});
      setCustomCard('');
      setActiveTab('challenging');
    }
  };

  const downloadPDF = async () => {
    // Check if libraries are loaded
    if (!pdfLibrariesLoaded) {
      alert('⚠️ PDF libraries are still loading. Please wait a moment and try again.');
      return;
    }

    if (typeof window.html2canvas === 'undefined') {
      alert('⚠️ html2canvas library not loaded. Please refresh the page and try again.');
      console.error('html2canvas not found');
      return;
    }

    if (typeof window.jsPDF === 'undefined') {
      alert('⚠️ jsPDF library not loaded. Please refresh the page and try again.');
      console.error('jsPDF not found');
      return;
    }

    try {
      // Create the PDF report content as HTML
      const reportHTML = generateReportHTML();
      
      // Create a hidden container for the report
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm'; // A4 width
      container.style.background = 'white';
      container.innerHTML = reportHTML;
      document.body.appendChild(container);

      // Wait for any images/fonts to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Convert to canvas
      const canvas = await window.html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Remove the temporary container
      document.body.removeChild(container);

      // Create PDF using jsPDF (using only default fonts to avoid font errors)
      const pdf = new window.jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297; // A4 height in mm

      // Add new pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      // Save the PDF
      const fileName = `MountainPath_${studentInitials || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('❌ Error creating PDF. Please try again or contact support.');
    }
  };

  const generateReportHTML = () => {
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const getDifficultyLabel = (level) => {
      const labels = {
        1: 'Very Comfortable',
        2: 'Comfortable',
        3: 'Neutral',
        4: 'Challenging',
        5: 'Very Challenging'
      };
      return labels[level] || '';
    };

    let html = `
<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white;">
  <div style="text-align: center; border-bottom: 4px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #1e40af; font-size: 32px; margin: 0 0 10px 0;">🏔️ Mountain Path Report</h1>
    <p style="color: #64748b; font-size: 14px; margin: 5px 0;">Visual Learning Environment Assessment</p>
    <p style="color: #64748b; font-size: 14px; margin: 5px 0;"><strong>Date:</strong> ${currentDate}</p>
  </div>
  
  <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; color: #1e40af;">Student Information</h3>
    <p style="margin: 5px 0;"><strong>Student Initials:</strong> ${studentInitials || 'Not specified'}</p>
    ${challengingSubject ? `<p style="margin: 5px 0;"><strong>Challenging Subject:</strong> ${challengingSubject}</p>` : ''}
    ${comfortableSubject ? `<p style="margin: 5px 0;"><strong>Comfortable Subject:</strong> ${comfortableSubject}</p>` : ''}
  </div>
`;

    // Challenging Subject Section
    if (Object.keys(challengingCards).length > 0) {
      html += `
  <div style="margin: 30px 0; page-break-inside: avoid;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; padding: 12px 20px; border-radius: 8px; font-size: 20px; font-weight: bold; margin-bottom: 20px;">
      📊 Challenging Subject: ${challengingSubject || 'Not specified'}
    </div>
`;
      
      [5, 4, 3, 2, 1].forEach(level => {
        if (challengingCards[level] && challengingCards[level].length > 0) {
          const bgColors = {
            5: '#fca5a5',
            4: '#fecaca',
            3: '#fed7aa',
            2: '#d9f99d',
            1: '#d1fae5'
          };
          const borderColors = {
            5: '#ef4444',
            4: '#f97316',
            3: '#f59e0b',
            2: '#84cc16',
            1: '#10b981'
          };
          
          html += `
    <div style="margin: 15px 0; padding: 15px; border-radius: 8px; background: ${bgColors[level]}; border-left: 5px solid ${borderColors[level]}; page-break-inside: avoid;">
      <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #1f2937;">${getDifficultyLabel(level)}</div>
`;
          challengingCards[level].forEach(card => {
            const solution = getCardSolution(card);
            html += `
      <div style="background: white; padding: 12px; margin: 8px 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px;">${card}</div>
`;
            if (solution) {
              html += `
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 10px 15px; margin: 10px 0; border-radius: 4px;">
          <div style="font-weight: 700; color: #1e40af; font-size: 12px; margin-bottom: 5px;">Student Ideas:</div>
          <div style="color: #1e40af; font-size: 14px; white-space: pre-wrap;">${solution}</div>
        </div>
`;
            }
            html += `
      </div>
`;
          });
          html += `
    </div>
`;
        }
      });
      
      html += `
  </div>
`;
    }

    // Comfortable Subject Section
    if (Object.keys(comfortableCards).length > 0) {
      html += `
  <div style="margin: 30px 0; page-break-inside: avoid;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; padding: 12px 20px; border-radius: 8px; font-size: 20px; font-weight: bold; margin-bottom: 20px;">
      ✅ Comfortable Subject: ${comfortableSubject || 'Not specified'}
    </div>
`;
      
      [1, 2, 3, 4, 5].forEach(level => {
        if (comfortableCards[level] && comfortableCards[level].length > 0) {
          const bgColors = {
            1: '#d1fae5',
            2: '#d9f99d',
            3: '#fed7aa',
            4: '#fecaca',
            5: '#fca5a5'
          };
          const borderColors = {
            1: '#10b981',
            2: '#84cc16',
            3: '#f59e0b',
            4: '#f97316',
            5: '#ef4444'
          };
          
          html += `
    <div style="margin: 15px 0; padding: 15px; border-radius: 8px; background: ${bgColors[level]}; border-left: 5px solid ${borderColors[level]}; page-break-inside: avoid;">
      <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #1f2937;">${getDifficultyLabel(level)}</div>
`;
          comfortableCards[level].forEach(card => {
            const solution = getCardSolution(card);
            html += `
      <div style="background: white; padding: 12px; margin: 8px 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px;">${card}</div>
`;
            if (solution) {
              html += `
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 10px 15px; margin: 10px 0; border-radius: 4px;">
          <div style="font-weight: 700; color: #1e40af; font-size: 12px; margin-bottom: 5px;">Student Ideas:</div>
          <div style="color: #1e40af; font-size: 14px; white-space: pre-wrap;">${solution}</div>
        </div>
`;
            }
            html += `
      </div>
`;
          });
          html += `
    </div>
`;
        }
      });
      
      html += `
  </div>
`;
    }

    // Planning Section
    if (planningCards.length > 0) {
      html += `
  <div style="margin: 30px 0; page-break-inside: avoid;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; padding: 12px 20px; border-radius: 8px; font-size: 20px; font-weight: bold; margin-bottom: 20px;">
      📝 Shared Planning & Action Steps
    </div>
`;
      
      planningCards.forEach((item, index) => {
        html += `
    <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 15px 0; page-break-inside: avoid;">
      <h4 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">${index + 1}. ${item.card}</h4>
`;
        if (item.solution) {
          html += `
      <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 10px 15px; margin: 10px 0; border-radius: 4px;">
        <div style="font-weight: 700; color: #1e40af; font-size: 12px; margin-bottom: 5px;">Student Ideas:</div>
        <div style="color: #1e40af; font-size: 14px; white-space: pre-wrap;">${item.solution}</div>
      </div>
`;
        }
        html += `
      <div style="margin: 12px 0; padding-left: 20px;">
        <span style="font-weight: 600; color: #4b5563; display: inline-block; min-width: 150px;">👥 Who will help:</span>
        <span style="color: #1f2937;">${item.who || 'To be determined'}</span>
      </div>
      <div style="margin: 12px 0; padding-left: 20px;">
        <span style="font-weight: 600; color: #4b5563; display: inline-block; min-width: 150px;">🎯 What will we try:</span>
        <span style="color: #1f2937;">${item.what || 'To be determined'}</span>
      </div>
      <div style="margin: 12px 0; padding-left: 20px;">
        <span style="font-weight: 600; color: #4b5563; display: inline-block; min-width: 150px;">📅 When will we review:</span>
        <span style="color: #1f2937;">${item.when || 'To be determined'}</span>
      </div>
    </div>
`;
      });
      
      html += `
  </div>
`;
    }

    // Footer
    html += `
  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 12px; color: #64748b;">
    <p style="margin: 5px 0;">This report was generated using the Mountain Path tool - a student-led approach to understanding visual learning environments.</p>
    <p style="margin: 5px 0;">Generated on ${currentDate}</p>
    <p style="margin: 10px 0; font-weight: 600; color: #1f2937;">Mountain Path - © 2025 Daniel Downes. All Rights Reserved</p>
  </div>
</div>
`;

    return html;
  };

  const renderCard = (cardText) => {
    const key = `${activeTab}-${cardText}`;
    const suggestionsVisible = showSuggestions[key];
    
    return (
      <div
        key={cardText}
        className="relative bg-white rounded-xl p-4 shadow-lg cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 border-2 border-gray-100 mb-3"
        style={{ minHeight: '140px', width: '190px' }}
        onClick={() => toggleCardFlip(cardText)}
      >
        {!isCardFlipped(cardText) ? (
          <div className="text-sm font-semibold text-gray-800 text-center flex items-center justify-center h-full leading-tight px-2">
            {cardText}
            <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-gradient-to-r from-blue-50 to-indigo-50 px-2 py-1 rounded-full border border-blue-200">
              Tap to flip
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="text-xs text-gray-600 mb-2 text-center font-bold">What could make this easier?</div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSuggestions(prev => ({...prev, [key]: !prev[key]}));
              }}
              className="mb-2 w-full text-xs bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white px-3 py-2 rounded-lg font-bold shadow-md transition-all duration-200 flex items-center justify-center gap-1"
            >
              <Lightbulb size={14} />
              {suggestionsVisible ? 'Hide' : 'Show'} Ideas
              {suggestionsVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            
            {suggestionsVisible && (
              <div className="mb-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-2 border-2 border-blue-300 max-h-32 overflow-y-auto">
                <div className="text-xs text-blue-900 font-bold mb-1">💡 Try these:</div>
                <div className="space-y-1">
                  {getSuggestedSolutions(cardText).map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentSolution = getCardSolution(cardText);
                        const newSolution = currentSolution ? `${currentSolution}\n• ${suggestion}` : `• ${suggestion}`;
                        updateCardSolution(cardText, newSolution);
                      }}
                      className="block text-xs text-blue-800 hover:text-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 text-left p-1.5 rounded w-full transition-all duration-200 border border-blue-200 hover:border-blue-400 font-medium"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <textarea
              className="flex-1 text-xs border-2 border-gray-300 rounded-lg p-2 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
              placeholder="Your ideas..."
              value={getCardSolution(cardText)}
              onChange={(e) => updateCardSolution(cardText, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            
            {activeTab === 'challenging' && (
              <button
                className="mt-2 text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-full hover:from-green-600 hover:to-emerald-700 shadow-lg transition-all duration-200 font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  moveToPlanning(cardText);
                }}
              >
                → Add to Planning
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMountainPath = () => {
    const currentCards = getCurrentCards();
    
    return (
      <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-2xl p-8 shadow-2xl relative border border-gray-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center bg-white px-8 py-4 rounded-2xl shadow-lg border-2 border-gray-200">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {activeTab === 'challenging' ? challengingSubject || 'Challenging Subject' : 
               activeTab === 'comfortable' ? comfortableSubject || 'Comfortable Subject' : 'Planning Session'}
            </h3>
          </div>
        </div>
        
        <div className="relative">
          <div className="flex gap-3 mb-6">
            {[1, 2, 3, 4, 5].map(difficulty => (
              <div
                key={difficulty}
                className={`flex-1 min-h-96 rounded-2xl border-4 border-dashed ${getDifficultyColor(difficulty)} relative p-3 transition-all duration-300 ${
                  showCardSelector ? 'hover:bg-blue-100 hover:border-blue-400 cursor-pointer hover:scale-105' : ''
                }`}
                onDrop={(e) => handleDrop(e, difficulty)}
                onDragOver={handleDragOver}
                onClick={() => showCardSelector && handleMobileCardPlace(difficulty)}
              >
                <div className="flex flex-col-reverse items-center justify-start h-full">
                  {currentCards[difficulty]?.map((cardText) => renderCard(cardText))}
                  {(!currentCards[difficulty] || currentCards[difficulty].length === 0) && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-gray-400">
                      <div className="text-3xl mb-2">📍</div>
                      <div className="text-sm font-semibold">
                        {showCardSelector ? 'Tap to place here' : 'Drop cards here'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            <div className="h-8 rounded-full overflow-hidden shadow-xl border-4 border-white" 
                 style={{
                   background: 'linear-gradient(to right, #10b981, #84cc16, #f59e0b, #f97316, #ef4444)'
                 }}>
              {[1, 2, 3, 4, 5].map(position => (
                <div
                  key={position}
                  className="absolute top-1/2 transform -translate-y-1/2 w-1/5 flex items-center justify-center"
                  style={{ left: `${(position - 1) * 20}%` }}
                >
                  <div className="w-5 h-5 bg-white rounded-full border-3 border-gray-700 shadow-lg"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between text-sm font-bold text-gray-700 mt-6 px-2">
            <span className="text-emerald-700">Very Comfortable</span>
            <span className="text-green-700">Comfortable</span>
            <span className="text-amber-700">Neutral</span>
            <span className="text-orange-700">Challenging</span>
            <span className="text-red-700">Very Challenging</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCardDeck = () => (
    <div className={`${isMobile ? 'w-full mb-4' : 'w-80'} bg-white rounded-2xl p-6 shadow-xl border-2 border-gray-100`}>
      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-xl mr-3 shadow-lg">
          <FileText className="text-white" size={20} />
        </div>
        Card Deck
      </h3>
      
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {getAvailableCards().map((card) => (
          <div
            key={card}
            draggable={!isMobile}
            onDragStart={(e) => !isMobile && handleDragStart(e, card)}
            onClick={() => isMobile && handleMobileCardSelect(card)}
            className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 cursor-pointer shadow-md hover:shadow-xl transition-all duration-200 border-2 border-blue-100 hover:border-blue-400 hover:scale-105 ${
              selectedCard?.text === card ? 'ring-2 ring-blue-500 bg-blue-100' : ''
            }`}
          >
            <div className="text-sm font-semibold text-gray-800 flex items-center justify-between">
              <span>{card}</span>
              {isMobile && <Plus size={16} className="text-blue-600" />}
            </div>
          </div>
        ))}
        
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
          <div className="text-sm font-semibold text-purple-700 mb-2">Create your own:</div>
          <input
            type="text"
            className="w-full text-sm border-2 border-purple-200 rounded-lg px-3 py-2"
            placeholder="Type your challenge here..."
            value={customCard}
            onChange={(e) => setCustomCard(e.target.value)}
          />
          {customCard && (
            <div
              draggable={!isMobile}
              onDragStart={(e) => !isMobile && handleDragStart(e, customCard, true)}
              onClick={() => isMobile && handleMobileCardSelect(customCard, true)}
              className={`mt-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-3 cursor-pointer text-sm border-2 border-purple-300 hover:border-purple-400 transition-all duration-200 ${
                selectedCard?.text === customCard ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">{customCard}</span>
                {isMobile && <Plus size={16} className="text-purple-600" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPlanning = () => (
    <div className="flex-1 bg-white rounded-2xl p-8 shadow-xl">
      <h3 className="text-2xl font-bold text-gray-800 mb-8 flex items-center">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded-xl mr-4 shadow-lg">
          <Users className="text-white" size={28} />
        </div>
        Shared Planning
      </h3>
      
      {planningCards.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="bg-gray-100 rounded-full p-8 w-32 h-32 mx-auto mb-6 flex items-center justify-center">
            <Users size={64} className="text-gray-400" />
          </div>
          <h4 className="text-xl font-semibold mb-2">Ready to Plan Together</h4>
          <p className="text-lg mb-2">No challenges selected for planning yet.</p>
          <p className="text-sm">Flip cards in the challenging subject and click "Add to Planning" to start.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {planningCards.map((item, index) => (
            <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200 shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-4">
                  <h4 className="font-bold text-gray-800 text-lg mb-2">{item.card}</h4>
                  {item.solution && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200">
                      <div className="text-xs text-blue-700 font-semibold mb-1">Student Ideas:</div>
                      <div className="text-sm text-blue-800 whitespace-pre-wrap">{item.solution}</div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removePlanningCard(index)}
                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-all duration-200"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Who will help? 👥</label>
                  <input
                    type="text"
                    className="w-full text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-green-400 focus:ring-2 focus:ring-green-200"
                    placeholder="Teacher, parent, support staff..."
                    value={item.who || ''}
                    onChange={(e) => updatePlanningCard(index, 'who', e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">What will we try? 🎯</label>
                  <input
                    type="text"
                    className="w-full text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-green-400 focus:ring-2 focus:ring-green-200"
                    placeholder="Specific action or accommodation..."
                    value={item.what || ''}
                    onChange={(e) => updatePlanningCard(index, 'what', e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">When will we review? 📅</label>
                  <input
                    type="text"
                    className="w-full text-sm border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-green-400 focus:ring-2 focus:ring-green-200"
                    placeholder="Next week, in two weeks..."
                    value={item.when || ''}
                    onChange={(e) => updatePlanningCard(index, 'when', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-gray-50 to-stone-100">
      {/* Copyright Bar */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-2 px-4 text-center text-xs font-medium shadow-md">
        Mountain Path - © 2025 Daniel Downes. All Rights Reserved
      </div>
      
      <div className={`bg-white shadow-xl border-b border-gray-200 z-40 ${!isMobile ? 'sticky top-0' : ''}`}>
        <div className={isMobile ? 'p-4' : 'max-w-7xl mx-auto p-6'}>
          <div className={`flex items-center justify-between ${isMobile ? 'flex-col space-y-4' : ''}`}>
            <div className="flex items-center space-x-4">
              <div className={`bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg ${isMobile ? 'p-3' : 'p-4'}`}>
                <Mountain size={isMobile ? 28 : 36} className="text-white" />
              </div>
              <div>
                <h1 className={`font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Mountain Path</h1>
                <p className={`text-gray-600 font-medium ${isMobile ? 'text-sm' : ''}`}>Student-led visual environment planning</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={resetAllData}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-3 rounded-xl flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                title="Reset all data"
              >
                <RotateCcw size={18} />
                {!isMobile && <span className="font-semibold">Reset</span>}
              </button>
              
              <button
                onClick={downloadPDF}
                disabled={!pdfLibrariesLoaded}
                className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl ${
                  !pdfLibrariesLoaded ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={!pdfLibrariesLoaded ? 'Loading PDF libraries...' : 'Download PDF Report'}
              >
                <Download size={18} />
                <span className="font-semibold">{isMobile ? 'PDF' : 'Download Report'}</span>
              </button>
            </div>
          </div>
          
          <div className={`flex flex-wrap gap-4 ${isMobile ? 'mt-4' : 'mt-6'}`}>
            <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-2 shadow-sm">
              <User size={18} className="text-gray-600" />
              <input
                type="text"
                placeholder="Student initials"
                className="border-0 bg-transparent text-sm font-medium focus:outline-none w-32"
                value={studentInitials}
                onChange={(e) => setStudentInitials(e.target.value)}
              />
            </div>
            
            {activeTab === 'challenging' && (
              <input
                type="text"
                placeholder="Challenging subject (e.g., Maths)"
                className="border-2 border-gray-200 rounded-xl px-4 py-2 text-sm font-medium shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                value={challengingSubject}
                onChange={(e) => setChallengingSubject(e.target.value)}
              />
            )}
            
            {activeTab === 'comfortable' && (
              <input
                type="text"
                placeholder="Comfortable subject (e.g., English)"
                className="border-2 border-gray-200 rounded-xl px-4 py-2 text-sm font-medium shadow-sm focus:border-green-400 focus:ring-2 focus:ring-green-200"
                value={comfortableSubject}
                onChange={(e) => setComfortableSubject(e.target.value)}
              />
            )}
          </div>
          
          <div className="flex gap-2 mt-4 border-t border-gray-200 pt-4">
            <button
              onClick={() => setActiveTab('challenging')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'challenging'
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Challenging
            </button>
            <button
              onClick={() => setActiveTab('comfortable')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'comfortable'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Comfortable
            </button>
            <button
              onClick={() => setActiveTab('planning')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'planning'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Planning
            </button>
          </div>
        </div>
      </div>

      {showCardSelector && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl p-6 w-full shadow-2xl max-h-[60vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Place Card</h3>
              <button
                onClick={() => {setShowCardSelector(false); setSelectedCard(null);}}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-semibold text-blue-900">Selected: {selectedCard.text}</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(difficulty => (
                <button
                  key={difficulty}
                  onClick={() => handleMobileCardPlace(difficulty)}
                  className={`p-4 rounded-xl font-bold text-sm ${getDifficultyColor(difficulty)} border-2 hover:scale-105 transition-all duration-200`}
                >
                  {difficulty}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`${isMobile ? 'p-4' : 'max-w-7xl mx-auto p-6'} flex gap-6 ${isMobile ? 'flex-col' : ''}`}>
        {activeTab !== 'planning' && renderCardDeck()}
        {activeTab === 'planning' ? renderPlanning() : renderMountainPath()}
      </div>
    </div>
  );
};

export default VisualAssessmentApp;
