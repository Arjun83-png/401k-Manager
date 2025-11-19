import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

// ---- Mock YTD data (hard-coded) ----
const MOCK_YTD = {
  year: new Date().getFullYear(),
  annualSalary: 80000,          // mock annual salary
  paychecksPerYear: 24,         // assume semi-monthly pay
  paychecksSoFar: 10,           // mock number of paychecks so far this year
  employeeContributionYtd: 3500,
  employerMatchYtd: 1750,
};

// Retirement assumptions for the impact card
const RETIREMENT_AGE = 65;
const EXPECTED_RETURN = 0.06;   // 6% annual return

// Simple future value of an annuity (constant yearly contributions)
function estimateRetirementBalance(annualSalary, ratePercent, yearsToRetire) {
  if (!annualSalary || ratePercent <= 0 || yearsToRetire <= 0) return 0;

  const yearlyContribution = (annualSalary * ratePercent) / 100;
  const r = EXPECTED_RETURN;
  const n = yearsToRetire;

  // FV = C * [ ((1+r)^n - 1) / r ]
  const fv = yearlyContribution * ((Math.pow(1 + r, n) - 1) / r);
  return fv;
}

// formatting helpers
const fmtMoney0 = (n) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtMoney2 = (n) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function App() {
  const [loading, setLoading] = useState(true);
  const [contributionType, setContributionType] = useState('percentage'); // 'percentage' or 'fixed'
  const [contributionValue, setContributionValue] = useState('');
  const [paycheckAmount, setPaycheckAmount] = useState('');
  const [age, setAge] = useState('30');
  const [statusMessage, setStatusMessage] = useState('');

  // Load current settings from Supabase (we’ll just use row with id=1)
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setStatusMessage('');

      const { data, error } = await supabase
        .from('contribution_settings')
        .select('*')
        .order('id', { ascending: true })
        .limit(1);

      if (error) {
        console.error(error);
        setStatusMessage('Error loading settings.');
      } else if (data && data.length > 0) {
        setContributionType(data[0].contribution_type);
        setContributionValue(String(data[0].contribution_value));
      }

      setLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setStatusMessage('');

    const valueNum = parseFloat(contributionValue);
    if (Number.isNaN(valueNum) || valueNum <= 0) {
      setStatusMessage('Please enter a positive contribution value.');
      return;
    }

    if (contributionType === 'percentage' && valueNum > 100) {
      setStatusMessage('Percentage contribution cannot be more than 100%.');
      return;
    }

    setLoading(true);

    // Update into row id=1 for demo
    const { error } = await supabase.from('contribution_settings').update(
      {
        contribution_type: contributionType,
        contribution_value: valueNum,
      },
    ).eq('id', 1);

    if (error) {
      console.error(error);
      setStatusMessage('Error saving settings.');
    } else {
      setStatusMessage('Settings saved!');
    }

    setLoading(false);
  };

  const renderSummary = () => {
    const valueNum = parseFloat(contributionValue);
    const paycheckNum = parseFloat(paycheckAmount);

    if (Number.isNaN(valueNum) || valueNum <= 0) {
      return <p className="summary-text">Set a valid contribution value to see a summary.</p>;
    }

    if (contributionType === 'fixed') {
      return (
        <p className="summary-text">
          You are contributing <strong>${valueNum.toFixed(2)}</strong> per paycheck to your 401(k).
        </p>
      );
    }

    // percentage type
    let text = `You are contributing ${valueNum.toFixed(2)}% of your paycheck to your 401(k).`;

    if (!Number.isNaN(paycheckNum) && paycheckNum > 0) {
      const dollarAmount = (paycheckNum * valueNum) / 100;
      text += ` That’s about $${dollarAmount.toFixed(2)} each paycheck.`;
    }

    return <p className="summary-text">{text}</p>;
  };

  // ---- Derived values for the mock YTD card ----
  const grossYtd =
    (MOCK_YTD.annualSalary / MOCK_YTD.paychecksPerYear) * MOCK_YTD.paychecksSoFar;

  const totalContributionYtd =
    MOCK_YTD.employeeContributionYtd + MOCK_YTD.employerMatchYtd;

  const IRS_EMPLOYEE_LIMIT = 23000; // simple mock limit
  const employeeProgressPct = Math.min(
    100,
    (MOCK_YTD.employeeContributionYtd / IRS_EMPLOYEE_LIMIT) * 100
  );

  // ---- Impact card calculations ----
  const enteredValue = parseFloat(contributionValue) || 0;
  const paycheckNum = parseFloat(paycheckAmount);

  // Annual salary: prefer user paycheck * paychecks/year, else mock salary
  const baseAnnualSalary =
    !Number.isNaN(paycheckNum) && paycheckNum > 0
      ? paycheckNum * MOCK_YTD.paychecksPerYear
      : MOCK_YTD.annualSalary;

  // Convert fixed-dollar contributions to an effective % of salary
  let effectiveRate = 0;
  if (contributionType === 'percentage') {
    effectiveRate = enteredValue;
  } else {
    const dollarsPerPaycheck = enteredValue;
    if (baseAnnualSalary > 0) {
      const yearly = dollarsPerPaycheck * MOCK_YTD.paychecksPerYear;
      effectiveRate = (yearly / baseAnnualSalary) * 100;
    }
  }

  const currentRate = Math.max(0, effectiveRate);
  const plusOneRate = Math.min(100, currentRate + 1);

  // Age -> years to retirement
  const ageNum = parseInt(age, 10);
  const yearsToRetire =
    Number.isNaN(ageNum) ? 0 : Math.max(0, RETIREMENT_AGE - ageNum);

  const balanceCurrent = estimateRetirementBalance(
    baseAnnualSalary,
    currentRate,
    yearsToRetire
  );
  const balancePlusOne = estimateRetirementBalance(
    baseAnnualSalary,
    plusOneRate,
    yearsToRetire
  );
  const balanceDiff = Math.max(0, balancePlusOne - balanceCurrent);

  const hasImpactData =
    baseAnnualSalary > 0 && currentRate > 0 && yearsToRetire > 0;

  return (
    <div className="app-root">
      <div className="page-layout">
        {/* LEFT: contribution manager card */}
        <div className="card">
          <h1 className="app-title">401(k) Contribution Manager</h1>
          <p className="app-subtitle">
            Choose how much you want to contribute each paycheck.
          </p>

          <form className="form" onSubmit={handleSave}>
            {/* Contribution Type */}
            <div className="form-section">
              <h2 className="section-title">Contribution Type</h2>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="contributionType"
                    value="percentage"
                    checked={contributionType === 'percentage'}
                    onChange={() => setContributionType('percentage')}
                  />
                  <span>Percentage of paycheck</span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="contributionType"
                    value="fixed"
                    checked={contributionType === 'fixed'}
                    onChange={() => setContributionType('fixed')}
                  />
                  <span>Fixed dollar amount</span>
                </label>
              </div>
            </div>

            {/* Contribution Value */}
            <div className="form-section">
              <h2 className="section-title">Contribution Amount</h2>
              <div className="input-row">
                {contributionType === 'percentage' ? (
                  <>
                    <label className="input-label" htmlFor="contributionValue">
                      Percentage per paycheck
                    </label>
                    <div className="input-with-addon">
                      <input
                        id="contributionValue"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={contributionValue}
                        onChange={(e) => setContributionValue(e.target.value)}
                        className="input"
                        placeholder="e.g., 5"
                      />
                      <span className="addon">%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="input-label" htmlFor="contributionValue">
                      Dollars per paycheck
                    </label>
                    <div className="input-with-addon">
                      <span className="addon">$</span>
                      <input
                        id="contributionValue"
                        type="number"
                        step="1"
                        min="0"
                        value={contributionValue}
                        onChange={(e) => setContributionValue(e.target.value)}
                        className="input"
                        placeholder="e.g., 200"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Paycheck amount for preview */}
            <div className="form-section">
              <h2 className="section-title">Paycheck Preview</h2>
              <div className="input-row">
                <label className="input-label" htmlFor="paycheckAmount">
                  Enter your gross paycheck amount
                </label>
                <div className="input-with-addon">
                  <span className="addon">$</span>
                  <input
                    id="paycheckAmount"
                    type="number"
                    step="1"
                    min="0"
                    value={paycheckAmount}
                    onChange={(e) => setPaycheckAmount(e.target.value)}
                    className="input"
                    placeholder="e.g., 3000"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="form-section">
              <h2 className="section-title">Summary</h2>
              {renderSummary()}
            </div>

            {/* Actions */}
            <div className="actions">
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save Settings'}
              </button>
              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </div>
          </form>
        </div>

        {/* MIDDLE: Show impact at retirement */}
        <div className="impact-card">
          <h2 className="impact-title">Impact by Retirement</h2>
          <p className="impact-subtitle">
            See how saving just 1% more of your salary could grow by retirement.
          </p>

          <div className="impact-section">
            <div className="impact-row">
              <span className="impact-label">Your age</span>
              <span className="impact-value impact-age-input">
                <input
                  type="number"
                  min="18"
                  max="70"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="input input-compact"
                />
                <span className="impact-age-arrow">→</span>
                <span className="impact-age-target">{RETIREMENT_AGE}</span>
                {yearsToRetire > 0 && (
                  <span className="impact-age-note">
                    ({yearsToRetire} years to invest)
                  </span>
                )}
              </span>
            </div>

            <div className="impact-row">
              <span className="impact-label">Estimated annual salary</span>
              <span className="impact-value">
                ${fmtMoney0(baseAnnualSalary)}
              </span>
            </div>

            <div className="impact-row">
              <span className="impact-label">Current effective contribution rate</span>
              <span className="impact-value">
                {currentRate > 0 ? `${currentRate.toFixed(1)}%` : '—'}
              </span>
            </div>

            <div className="impact-row">
              <span className="impact-label">With +1% contribution</span>
              <span className="impact-value">
                {currentRate > 0 ? `${plusOneRate.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>

          <div className="impact-section impact-section-highlight">
            {hasImpactData ? (
              <>
                <div className="impact-row">
                  <span className="impact-label">
                    Projected balance at retirement (current rate)
                  </span>
                  <span className="impact-value-strong">
                    ${fmtMoney0(balanceCurrent)}
                  </span>
                </div>

                <div className="impact-row">
                  <span className="impact-label">
                    Projected balance with +1% contribution
                  </span>
                  <span className="impact-value-strong">
                    ${fmtMoney0(balancePlusOne)}
                  </span>
                </div>

                <div className="impact-delta">
                  Saving just <strong>1% more</strong> could add roughly{' '}
                  <strong>${fmtMoney0(balanceDiff)}</strong> by retirement.
                </div>
              </>
            ) : (
              <p className="impact-empty">
                Enter your age, contribution, and (optionally) paycheck info to see
                how an extra 1% could grow over time.
              </p>
            )}
          </div>

          <p className="impact-footnote">
            This is a simplified projection using a {(
              EXPECTED_RETURN * 100
            ).toFixed(0)}
            % yearly return and constant salary. Real investment results will differ.
          </p>
        </div>

        {/* RIGHT: mock YTD data card */}
        <div className="ytd-card">
          <h2 className="ytd-title">
            {MOCK_YTD.year} Year-to-Date Contributions
          </h2>
          <p className="ytd-subtitle">
            This is sample data based on a mock salary and contribution history.
          </p>

          <div className="ytd-grid">
            <div className="ytd-item">
              <span className="ytd-label">Annual salary (mock)</span>
              <span className="ytd-value">
                ${MOCK_YTD.annualSalary.toLocaleString()}
              </span>
            </div>

            <div className="ytd-item">
              <span className="ytd-label">Paychecks so far</span>
              <span className="ytd-value">{MOCK_YTD.paychecksSoFar}</span>
            </div>

            <div className="ytd-item">
              <span className="ytd-label">Gross pay YTD (mock)</span>
              <span className="ytd-value">
                ${fmtMoney2(grossYtd)}
              </span>
            </div>

            <div className="ytd-item">
              <span className="ytd-label">Employee contributions YTD</span>
              <span className="ytd-value">
                ${MOCK_YTD.employeeContributionYtd.toLocaleString()}
              </span>
            </div>

            <div className="ytd-item">
              <span className="ytd-label">Employer match YTD</span>
              <span className="ytd-value">
                ${MOCK_YTD.employerMatchYtd.toLocaleString()}
              </span>
            </div>

            <div className="ytd-item">
              <span className="ytd-label">Total into 401(k) YTD</span>
              <span className="ytd-value ytd-value-strong">
                ${totalContributionYtd.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="ytd-progress-section">
            <div className="ytd-progress-header">
              <span className="ytd-label">
                Progress toward employee limit (${IRS_EMPLOYEE_LIMIT.toLocaleString()})
              </span>
              <span className="ytd-progress-number">
                {employeeProgressPct.toFixed(1)}%
              </span>
            </div>
            <div className="ytd-progress-bar">
              <div
                className="ytd-progress-fill"
                style={{ width: `${employeeProgressPct}%` }}
              />
            </div>
          </div>

          <p className="ytd-footnote">
            These numbers are for display only and do not reflect any real account.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;