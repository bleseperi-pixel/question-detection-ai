import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from predictor import (  # noqa: E402
    analyze,
    build_question_paper,
    group_questions,
    parse_questions,
)

SAMPLE = """1. Explain the process of normalization in DBMS (5 marks)
2. Explain normalization process in DBMS [5 marks]
3. Define primary key.
4. What is a primary key? 2 marks
5. Describe the ACID properties of transactions (5 marks)
"""


def test_parse_extracts_marks_and_strips_numbering():
    questions = parse_questions(SAMPLE)
    assert questions[0].text == "Explain the process of normalization in DBMS"
    assert questions[0].marks == 5
    assert questions[1].marks == 5
    assert questions[2].marks is None
    assert questions[3].marks == 2


def test_parse_ignores_empty_and_very_short_lines():
    assert parse_questions("\n  \nok\n") == []


def test_similar_questions_are_grouped_and_ranked_first():
    groups = group_questions(parse_questions(SAMPLE), threshold=0.5)
    repeated = [g for g in groups if g.frequency > 1]
    assert len(repeated) == 2
    assert groups[0].frequency == 2
    assert all(g.score >= 1 for g in groups)


def test_unrelated_questions_stay_separate_even_at_low_threshold():
    questions = parse_questions(
        "Explain the OSI model layers\n"
        "What is photosynthesis in plants\n"
        "Describe the French revolution causes\n"
    )
    groups = group_questions(questions, threshold=0.5)
    assert len(groups) == len(questions)
    assert all(g.frequency == 1 for g in groups)


def test_paper_matches_requested_marks_without_duplicates():
    groups = group_questions(parse_questions(SAMPLE), threshold=0.5)
    paper = build_question_paper(
        groups,
        [{"marks": 2, "count": 1}, {"marks": 5, "count": 2}],
        title="Test",
    )
    all_questions = [q for s in paper["sections"] for q in s["questions"]]
    texts = [q["question"] for q in all_questions]
    assert len(texts) == len(set(texts))
    assert [q["marks"] for q in paper["sections"][0]["questions"]] == [2]
    assert [q["marks"] for q in paper["sections"][1]["questions"]] == [5, 5]
    assert paper["total_marks"] == 12
    assert [q["number"] for q in all_questions] == [1, 2, 3]
    assert paper["warnings"] == []


def test_paper_warns_when_not_enough_questions():
    groups = group_questions(parse_questions(SAMPLE), threshold=0.5)
    paper = build_question_paper(groups, [{"marks": 2, "count": 10}])
    assert len(paper["warnings"]) == 1
    assert "Only" in paper["warnings"][0]


def test_analyze_returns_stats_predictions_and_paper():
    result = analyze(SAMPLE, threshold=0.5, top_n=3, sections=[{"marks": 5, "count": 1}])
    assert result["stats"]["questions_read"] == 5
    assert len(result["predictions"]) == 3
    assert result["paper"]["total_marks"] == 5


def test_analyze_without_sections_has_no_paper():
    assert analyze(SAMPLE)["paper"] is None


def test_empty_input_is_safe():
    result = analyze("   ")
    assert result["stats"]["questions_read"] == 0
    assert result["predictions"] == []
